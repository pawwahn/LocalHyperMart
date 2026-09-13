package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.dto.request.CreateDeliverySettlementRequest;
import com.hyperlocalmart.payment.dto.request.MarkSettlementPaidRequest;
import com.hyperlocalmart.payment.dto.response.DeliverySettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.entity.Settlement;
import com.hyperlocalmart.payment.entity.SettlementDirection;
import com.hyperlocalmart.payment.entity.SettlementLineItem;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementPeriodType;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import com.hyperlocalmart.payment.repository.SettlementLineItemRepository;
import com.hyperlocalmart.payment.repository.SettlementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeliverySettlementService {

    private static final List<SettlementStatus> BLOCKING =
            List.of(SettlementStatus.DRAFT, SettlementStatus.FINALIZED, SettlementStatus.PAID);

    private final OrderClient orderClient;
    private final DeliveryClient deliveryClient;
    private final TownClient townClient;
    private final SettlementRepository settlementRepository;
    private final SettlementLineItemRepository settlementLineItemRepository;
    private final SettlementService settlementService;

    @Transactional(readOnly = true)
    public DeliverySettlementCandidateView listCandidates(
            UUID townId, SettlementPayeeType payeeType, UUID payeeId, LocalDate from, LocalDate to) {
        if (payeeType != SettlementPayeeType.HUB && payeeType != SettlementPayeeType.AGENT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "payeeType must be HUB or AGENT");
        }
        if (from == null || to == null || to.isBefore(from)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid date range");
        }
        TownClient.DeliveryPayoutConfig config = townClient.deliveryPayoutConfig(townId);
        TownClient.DeliveryPayoutConfig.Party party =
                payeeType == SettlementPayeeType.HUB ? config.hub() : config.agent();

        DeliverySettlementCandidateView.FranchiseDue franchise = null;
        String model = "PER_ORDER";
        if (payeeType == SettlementPayeeType.HUB) {
            franchise = franchiseDue(townId, payeeId, from, to, config.hub());
            boolean perOrderOn = party != null && party.enabled() && party.perOrder() != null && party.perOrder().enabled();
            boolean franchiseOn = franchise != null && franchise.isEnabled();
            if (franchiseOn && perOrderOn) {
                model = "BOTH";
            } else if (franchiseOn) {
                model = "FRANCHISE";
            }
        }

        List<DeliverySettlementCandidateView.Item> items = List.of();
        boolean wantOrders = party != null && party.enabled()
                && party.perOrder() != null && party.perOrder().enabled();
        if (wantOrders) {
            items = perOrderItems(townId, payeeType, payeeId, from, to, party);
        }

        return DeliverySettlementCandidateView.builder()
                .townId(townId)
                .payeeId(payeeId)
                .payeeType(payeeType.name())
                .from(from.toString())
                .to(to.toString())
                .hubPayoutModel(model)
                .franchise(franchise)
                .items(items)
                .build();
    }

    @Transactional
    public SettlementResponse create(UUID actorId, CreateDeliverySettlementRequest request) {
        if (request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "periodEnd must be on or after periodStart");
        }
        SettlementPayeeType payeeType = request.getPayeeType();
        if (payeeType != SettlementPayeeType.HUB && payeeType != SettlementPayeeType.AGENT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "payeeType must be HUB or AGENT");
        }
        String kind = request.getKind() == null ? "PER_ORDER" : request.getKind().trim().toUpperCase(Locale.ROOT);
        if ("FRANCHISE".equals(kind)) {
            return createFranchise(actorId, request);
        }
        if (!"PER_ORDER".equals(kind)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "kind must be PER_ORDER or FRANCHISE");
        }
        return createPerOrder(actorId, request);
    }

    private SettlementResponse createFranchise(UUID actorId, CreateDeliverySettlementRequest request) {
        if (request.getPayeeType() != SettlementPayeeType.HUB) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Franchise collection is only for hubs");
        }
        TownClient.DeliveryPayoutConfig config = townClient.deliveryPayoutConfig(request.getTownId());
        DeliverySettlementCandidateView.FranchiseDue due =
                franchiseDue(request.getTownId(), request.getPayeeId(), request.getPeriodStart(), request.getPeriodEnd(), config.hub());
        if (due == null || !due.isEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Franchise is not enabled for this town");
        }
        if (due.isAlreadyCollected()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Franchise fee already collected for this period");
        }
        if (due.getAmount() == null || due.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Franchise amount must be more than ₹0");
        }
        LocalDate start = LocalDate.parse(due.getPeriodStart());
        LocalDate end = LocalDate.parse(due.getPeriodEnd());
        Settlement settlement = Settlement.builder()
                .townId(request.getTownId())
                .payeeType(SettlementPayeeType.HUB)
                .direction(SettlementDirection.COLLECTION)
                .payeeId(request.getPayeeId())
                .payeeName(request.getPayeeName())
                .periodStart(start)
                .periodEnd(end)
                .periodType(franchisePeriodType(due.getCadence()))
                .grossAmount(due.getAmount())
                .commissionAmount(BigDecimal.ZERO)
                .netAmount(due.getAmount())
                .status(SettlementStatus.DRAFT)
                .build();
        settlement.setCreatedBy(actorId);
        settlement.setUpdatedBy(actorId);
        SettlementLineItem line = SettlementLineItem.builder()
                .settlement(settlement)
                .lineType("FRANCHISE")
                .amount(due.getAmount())
                .description(due.getLabel())
                .build();
        line.setCreatedBy(actorId);
        line.setUpdatedBy(actorId);
        settlement.getLineItems().add(line);
        if (request.isMarkPaid()) {
            applyPaid(settlement, actorId, request);
        }
        SettlementResponse saved = settlementService.get(settlementRepository.save(settlement).getId());
        townClient.appendAdminAudit(
                "settlements",
                "FRANCHISE_COLLECT",
                "Collected franchise ₹" + saved.getNetAmount(),
                actorId,
                request.getTownId(),
                saved.getId());
        return saved;
    }

    private SettlementResponse createPerOrder(UUID actorId, CreateDeliverySettlementRequest request) {
        List<UUID> requested = request.getOrderIds() == null ? List.of()
                : request.getOrderIds().stream().distinct().toList();
        if (requested.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Select at least one completed order");
        }
        TownClient.DeliveryPayoutConfig config = townClient.deliveryPayoutConfig(request.getTownId());
        TownClient.DeliveryPayoutConfig.Party party =
                request.getPayeeType() == SettlementPayeeType.HUB ? config.hub() : config.agent();
        if (party == null || !party.enabled() || party.perOrder() == null || !party.perOrder().enabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Per-order payout is not enabled");
        }

        List<OrderClient.DeliveryCompleteOrder> resolved = orderClient.resolveDeliveryComplete(requested);
        if (resolved.size() != requested.size()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Only delivered customer orders can be paid — cancelled or incomplete orders are excluded");
        }
        Map<UUID, DeliveryClient.OrderLegs> legs = legsByOrder(requested);
        List<PricedOrder> priced = new ArrayList<>();
        for (OrderClient.DeliveryCompleteOrder order : resolved) {
            if (!request.getTownId().equals(order.townId())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Order is not in this town");
            }
            DeliveryClient.OrderLegs leg = legs.get(order.orderId());
            String skip = skipReason(request.getPayeeType(), request.getPayeeId(), order, leg);
            if (skip != null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, skip + " (" + order.orderNumber() + ")");
            }
            BigDecimal amount = amountFor(party, leg);
            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Pay is ₹0 for " + order.orderNumber() + " — set a rate first");
            }
            priced.add(new PricedOrder(order, amount));
        }

        Set<UUID> already = new HashSet<>(settlementLineItemRepository.findSettledDeliveryOrderIds(
                requested, request.getPayeeType(), request.getPayeeId(), BLOCKING));
        if (!already.isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Some orders are already in a hub/agent payout");
        }

        BigDecimal gross = priced.stream().map(PricedOrder::amount).reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        Settlement settlement = Settlement.builder()
                .townId(request.getTownId())
                .payeeType(request.getPayeeType())
                .direction(SettlementDirection.PAYOUT)
                .payeeId(request.getPayeeId())
                .payeeName(request.getPayeeName())
                .periodStart(request.getPeriodStart())
                .periodEnd(request.getPeriodEnd())
                .periodType(request.getPeriodType() == null ? SettlementPeriodType.CUSTOM : request.getPeriodType())
                .grossAmount(gross)
                .commissionAmount(BigDecimal.ZERO)
                .netAmount(gross)
                .status(SettlementStatus.DRAFT)
                .build();
        settlement.setCreatedBy(actorId);
        settlement.setUpdatedBy(actorId);
        for (PricedOrder row : priced) {
            SettlementLineItem line = SettlementLineItem.builder()
                    .settlement(settlement)
                    .orderId(row.order().orderId())
                    .orderNumber(row.order().orderNumber())
                    .lineType("DELIVERY_ORDER")
                    .amount(row.amount())
                    .description("Completed order payout")
                    .build();
            line.setCreatedBy(actorId);
            line.setUpdatedBy(actorId);
            settlement.getLineItems().add(line);
        }
        if (request.isMarkPaid()) {
            applyPaid(settlement, actorId, request);
        }
        SettlementResponse saved = settlementService.get(settlementRepository.save(settlement).getId());
        townClient.appendAdminAudit(
                "settlements",
                "DELIVERY_PAYOUT",
                "Paid " + request.getPayeeType() + " ₹" + saved.getNetAmount(),
                actorId,
                request.getTownId(),
                saved.getId());
        return saved;
    }

    private List<DeliverySettlementCandidateView.Item> perOrderItems(
            UUID townId,
            SettlementPayeeType payeeType,
            UUID payeeId,
            LocalDate from,
            LocalDate to,
            TownClient.DeliveryPayoutConfig.Party party) {
        List<OrderClient.DeliveryCompleteOrder> delivered = orderClient.listDeliveryComplete(townId, from, to);
        List<UUID> ids = delivered.stream().map(OrderClient.DeliveryCompleteOrder::orderId).toList();
        Map<UUID, DeliveryClient.OrderLegs> legs = legsByOrder(ids);
        Set<UUID> settled = ids.isEmpty() ? Set.of()
                : new HashSet<>(settlementLineItemRepository.findSettledDeliveryOrderIds(ids, payeeType, payeeId, BLOCKING));
        List<DeliverySettlementCandidateView.Item> items = new ArrayList<>();
        for (OrderClient.DeliveryCompleteOrder order : delivered) {
            DeliveryClient.OrderLegs leg = legs.get(order.orderId());
            String skip = skipReason(payeeType, payeeId, order, leg);
            BigDecimal amount = skip == null ? amountFor(party, leg) : BigDecimal.ZERO;
            if (skip == null && amount.compareTo(BigDecimal.ZERO) <= 0) {
                skip = "Pay is ₹0";
            }
            items.add(DeliverySettlementCandidateView.Item.builder()
                    .orderId(order.orderId())
                    .orderNumber(order.orderNumber())
                    .deliveredAt(order.deliveredAt())
                    .paymentStatus(order.paymentStatus())
                    .lastMileCompleted(leg != null && leg.lastMileCompleted())
                    .pickupCompleted(leg != null && leg.pickupCompleted())
                    .amount(amount)
                    .alreadySettled(settled.contains(order.orderId()))
                    .skipReason(skip)
                    .build());
        }
        return items;
    }

    private String skipReason(
            SettlementPayeeType payeeType,
            UUID payeeId,
            OrderClient.DeliveryCompleteOrder order,
            DeliveryClient.OrderLegs leg) {
        if (order == null || order.status() == null || !"DELIVERED".equalsIgnoreCase(order.status())) {
            return "Order is not delivered";
        }
        if (order.deliveredAt() == null) {
            return "No delivery time";
        }
        if (payeeType == SettlementPayeeType.AGENT) {
            if (leg == null || !leg.lastMileCompleted() || leg.agentId() == null) {
                return "Home trip not completed";
            }
            if (!payeeId.equals(leg.agentId())) {
                return "Home trip was another agent";
            }
        }
        if (payeeType == SettlementPayeeType.HUB) {
            if (leg == null || leg.hubId() == null) {
                return "No hub assignment";
            }
            if (!payeeId.equals(leg.hubId())) {
                return "Order belongs to another hub";
            }
        }
        return null;
    }

    private BigDecimal amountFor(TownClient.DeliveryPayoutConfig.Party party, DeliveryClient.OrderLegs leg) {
        if (party == null || party.perOrder() == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        TownClient.DeliveryPayoutConfig.PerOrder rates = party.perOrder();
        BigDecimal total = BigDecimal.ZERO;
        if (rates.completedOrderAmount() != null) {
            total = total.add(rates.completedOrderAmount());
        }
        if (leg != null && leg.pickupCompleted() && rates.pickupAmount() != null) {
            total = total.add(rates.pickupAmount());
        }
        if (leg != null && leg.lastMileCompleted() && rates.lastMileAmount() != null) {
            total = total.add(rates.lastMileAmount());
        }
        return total.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private Map<UUID, DeliveryClient.OrderLegs> legsByOrder(List<UUID> orderIds) {
        Map<UUID, DeliveryClient.OrderLegs> map = new HashMap<>();
        for (DeliveryClient.OrderLegs leg : deliveryClient.resolveDeliveryLegs(orderIds)) {
            if (leg != null && leg.orderId() != null) {
                map.put(leg.orderId(), leg);
            }
        }
        return map;
    }

    private DeliverySettlementCandidateView.FranchiseDue franchiseDue(
            UUID townId,
            UUID hubId,
            LocalDate from,
            LocalDate to,
            TownClient.DeliveryPayoutConfig.Party hub) {
        if (hub == null || hub.franchise() == null || !hub.franchise().enabled()) {
            return DeliverySettlementCandidateView.FranchiseDue.builder()
                    .enabled(false)
                    .cadence("MONTHLY")
                    .amount(BigDecimal.ZERO)
                    .periodStart(from.toString())
                    .periodEnd(to.toString())
                    .alreadyCollected(false)
                    .label("Franchise off")
                    .build();
        }
        String cadence = hub.franchise().cadence() == null ? "MONTHLY" : hub.franchise().cadence().toUpperCase(Locale.ROOT);
        LocalDate[] window = franchiseWindow(cadence, from, to);
        boolean collected;
        if ("LIFETIME".equals(cadence)) {
            collected = !settlementRepository.findAnyFranchiseCollections(
                    SettlementPayeeType.HUB, hubId, BLOCKING).isEmpty();
        } else {
            collected = !settlementRepository.findFranchiseCollections(
                    SettlementPayeeType.HUB, hubId, window[0], window[1], BLOCKING).isEmpty();
        }
        BigDecimal amount = hub.franchise().amount() == null ? BigDecimal.ZERO : hub.franchise().amount();
        return DeliverySettlementCandidateView.FranchiseDue.builder()
                .enabled(true)
                .cadence(cadence)
                .amount(amount)
                .periodStart(window[0].toString())
                .periodEnd(window[1].toString())
                .alreadyCollected(collected)
                .label(franchiseLabel(cadence, window[0], window[1], amount))
                .build();
    }

    private static LocalDate[] franchiseWindow(String cadence, LocalDate from, LocalDate to) {
        LocalDate anchor = to == null ? from : to;
        return switch (cadence) {
            case "QUARTERLY" -> {
                int q = ((anchor.getMonthValue() - 1) / 3) * 3 + 1;
                LocalDate start = LocalDate.of(anchor.getYear(), q, 1);
                yield new LocalDate[] { start, start.plusMonths(3).minusDays(1) };
            }
            case "YEARLY" -> new LocalDate[] {
                    LocalDate.of(anchor.getYear(), 1, 1),
                    LocalDate.of(anchor.getYear(), 12, 31)
            };
            case "LIFETIME" -> new LocalDate[] { LocalDate.of(2000, 1, 1), LocalDate.of(2099, 12, 31) };
            default -> new LocalDate[] {
                    anchor.withDayOfMonth(1),
                    anchor.withDayOfMonth(anchor.lengthOfMonth())
            };
        };
    }

    private static String franchiseLabel(String cadence, LocalDate start, LocalDate end, BigDecimal amount) {
        return "Franchise " + cadence.toLowerCase(Locale.ROOT) + " " + start + "–" + end + " · ₹" + amount;
    }

    private static SettlementPeriodType franchisePeriodType(String cadence) {
        return switch (cadence == null ? "" : cadence) {
            case "YEARLY", "LIFETIME" -> SettlementPeriodType.CUSTOM;
            case "QUARTERLY" -> SettlementPeriodType.CUSTOM;
            default -> SettlementPeriodType.MONTH;
        };
    }

    private void applyPaid(Settlement settlement, UUID actorId, CreateDeliverySettlementRequest request) {
        String method = request.getPayoutMethod() == null ? "" : request.getPayoutMethod().trim();
        String ref = request.getTransactionReference() == null ? "" : request.getTransactionReference().trim();
        if (method.isBlank() || ref.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Txn ref and payout method are required");
        }
        settlement.setStatus(SettlementStatus.PAID);
        settlement.setPayoutMethod(method.toUpperCase(Locale.ROOT));
        settlement.setTransactionReference(ref);
        settlement.setTransactionNotes(request.getTransactionNotes());
        settlement.setPaidAt(request.getPaidAt() == null ? java.time.Instant.now() : request.getPaidAt());
        settlement.setPaidBy(actorId);
        settlement.setUpdatedBy(actorId);
    }

    public SettlementResponse markPaid(UUID actorId, UUID settlementId, MarkSettlementPaidRequest request) {
        return settlementService.markPaid(actorId, settlementId, request);
    }

    private record PricedOrder(OrderClient.DeliveryCompleteOrder order, BigDecimal amount) {
    }
}
