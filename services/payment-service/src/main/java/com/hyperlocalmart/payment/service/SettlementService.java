package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.DeliveryClient.AgentSummary;
import com.hyperlocalmart.payment.client.DeliveryClient.OrderLegs;
import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.OrderClient.SettlementCandidateItem;
import com.hyperlocalmart.payment.client.VendorClient;
import com.hyperlocalmart.payment.dto.request.CreateSettlementRequest;
import com.hyperlocalmart.payment.dto.request.MarkSettlementPaidRequest;
import com.hyperlocalmart.payment.dto.response.SettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.dto.response.VendorCodCashHolderResponse;
import com.hyperlocalmart.payment.dto.response.VendorOrderPayoutResponse;
import com.hyperlocalmart.payment.entity.SettlementDirection;
import com.hyperlocalmart.payment.entity.*;
import com.hyperlocalmart.payment.entity.CodAgentHandoverLine;
import com.hyperlocalmart.payment.entity.CodAgentHandoverStatus;
import com.hyperlocalmart.payment.entity.CodCustodianType;
import com.hyperlocalmart.payment.repository.CodAgentHandoverLineRepository;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import com.hyperlocalmart.payment.repository.SettlementLineItemRepository;
import com.hyperlocalmart.payment.repository.SettlementRepository;
import com.hyperlocalmart.payment.repository.VendorSettlementAdjustmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SettlementService {

    private static final List<SettlementStatus> BLOCKING_STATUSES =
            List.of(SettlementStatus.DRAFT, SettlementStatus.FINALIZED, SettlementStatus.PAID);

    private final SettlementRepository settlementRepository;
    private final SettlementLineItemRepository settlementLineItemRepository;
    private final CodCloseDayLineItemRepository codCloseDayLineItemRepository;
    private final CodAgentHandoverLineRepository codAgentHandoverLineRepository;
    private final VendorSettlementAdjustmentRepository vendorSettlementAdjustmentRepository;
    private final OrderClient orderClient;
    private final DeliveryClient deliveryClient;
    private final VendorClient vendorClient;
    private final TownClient townClient;
    private final ServiceInvoiceNumberService serviceInvoiceNumberService;
    private final PayeeDisplayNameService payeeDisplayNameService;

    /** Order lookup stays outside a DB transaction so a slow call cannot pin the pool. */
    public SettlementCandidateView listCandidates(UUID townId, UUID vendorId, LocalDate from, LocalDate to) {
        var candidates = orderClient.getSettlementCandidates(vendorId, townId, from, to);
        List<UUID> ids = candidates.items() == null ? List.of()
                : candidates.items().stream().map(SettlementCandidateItem::subOrderId).toList();
        Set<UUID> settled = ids.isEmpty() ? Set.of()
                : new HashSet<>(settlementLineItemRepository.findSettledSubOrderIds(ids, BLOCKING_STATUSES));

        List<SettlementCandidateItem> rawItems =
                candidates.items() == null ? List.of() : candidates.items();
        List<UUID> codOrderIds = rawItems.stream()
                .filter(item -> isCod(item.paymentMethod()))
                .map(SettlementCandidateItem::orderId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Set<UUID> codRemittedOrderIds = codOrderIds.isEmpty()
                ? Set.of()
                : new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(codOrderIds));
        Map<UUID, CodAgentHandover> handoverByOrder = loadLatestHandovers(codOrderIds);

        Map<UUID, AgentRef> deliveringAgentByOrder = resolveDeliveringAgents(
                rawItems, codRemittedOrderIds, handoverByOrder, vendorId);

        List<SettlementCandidateView.Item> items = rawItems.stream()
                .map(item -> {
                    boolean cod = isCod(item.paymentMethod());
                    String codLocation = null;
                    Boolean remittedHub = null;
                    if (cod) {
                        codLocation = resolveCodCashLocation(
                                item.orderId(), codRemittedOrderIds, handoverByOrder);
                        remittedHub = "AT_HUB".equals(codLocation);
                        if (item.vendorAgentDelivery() && !"AT_HUB".equals(codLocation)) {
                            remittedHub = false;
                        }
                    }
                    AgentRef agent = "WITH_AGENT".equals(codLocation)
                            ? deliveringAgentByOrder.get(item.orderId())
                            : null;
                    return SettlementCandidateView.Item.builder()
                            .subOrderId(item.subOrderId())
                            .orderId(item.orderId())
                            .orderNumber(item.orderNumber())
                            .subOrderNumber(item.subOrderNumber())
                            .placedAt(item.placedAt())
                            .status(item.status())
                            .paymentStatus(item.paymentStatus())
                            .paymentMethod(item.paymentMethod())
                            .vendorAgentDelivery(item.vendorAgentDelivery())
                            .codRemittedToHub(remittedHub)
                            .codCashLocation(codLocation)
                            .codDeliveringAgentId(agent != null ? agent.agentId() : null)
                            .codDeliveringAgentName(agent != null ? agent.name() : null)
                            .codDeliveringAgentPhone(agent != null ? agent.phone() : null)
                            .subtotal(item.subtotal())
                            .alreadySettled(settled.contains(item.subOrderId()))
                            .build();
                })
                .toList();

        List<VendorSettlementAdjustment> pendingAdjustments =
                vendorSettlementAdjustmentRepository.findByVendorIdAndTownIdAndStatusOrderByCreatedAtAsc(
                        vendorId, townId, VendorSettlementAdjustmentStatus.PENDING);
        BigDecimal pendingClaimChargebacks = pendingAdjustments.stream()
                .map(VendorSettlementAdjustment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<SettlementCandidateView.PendingClaim> pendingClaims = pendingAdjustments.stream()
                .map(adj -> SettlementCandidateView.PendingClaim.builder()
                        .claimId(adj.getClaimId())
                        .orderNumber(adj.getOrderNumber())
                        .amount(adj.getAmount())
                        .reason(adj.getReason())
                        .build())
                .toList();

        return SettlementCandidateView.builder()
                .vendorId(vendorId)
                .townId(townId)
                .from(from.toString())
                .to(to.toString())
                .pendingClaimChargebacks(pendingClaimChargebacks)
                .pendingClaimCount(pendingAdjustments.size())
                .pendingClaims(pendingClaims)
                .items(items)
                .build();
    }

    @Transactional
    public SettlementResponse create(UUID actorId, CreateSettlementRequest request) {
        if (request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "periodEnd must be on or after periodStart");
        }
        SettlementDirection direction = request.getDirection() == null
                ? SettlementDirection.PAYOUT
                : request.getDirection();
        boolean collection = direction == SettlementDirection.COLLECTION;
        List<UUID> requestedIds = request.getSubOrderIds() == null
                ? List.of()
                : request.getSubOrderIds().stream().filter(Objects::nonNull).distinct().toList();
        if (!collection && requestedIds.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Select at least one bag to pay the vendor");
        }

        List<SettlementCandidateItem> resolved = requestedIds.isEmpty()
                ? List.of()
                : orderClient.resolveSettlementSubOrders(request.getVendorId(), requestedIds);
        if (resolved.size() != requestedIds.size()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "One or more orders are not eligible — only delivered bags can be settled");
        }

        if (!requestedIds.isEmpty()) {
            Set<UUID> already = new HashSet<>(
                    settlementLineItemRepository.findSettledSubOrderIds(requestedIds, BLOCKING_STATUSES));
            if (!already.isEmpty()) {
                throw new BusinessException(ErrorCode.CONFLICT,
                        "Some orders are already included in a settlement: " + already.size());
            }
        }

        Map<UUID, String> cashByOrder = cashLocationsFor(resolved);
        for (SettlementCandidateItem item : resolved) {
            boolean shopHolds = vendorHoldsBuyerCash(
                    item.vendorAgentDelivery(),
                    item.paymentMethod(),
                    cashByOrder.get(item.orderId()));
            if (!collection && shopHolds) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Bag " + item.orderNumber()
                                + " already holds COD at the shop. Collect fees on Vendor pays KoyaKart — do not pay GMV.");
            }
            if (collection && !shopHolds) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Bag " + item.orderNumber()
                                + " is online or cash is at hub. Pay the vendor on KoyaKart pays vendor.");
            }
        }

        BigDecimal gross = resolved.stream()
                .map(SettlementCandidateItem::subtotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<VendorClient.OrderLine> orderLines = resolved.stream()
                .map(item -> new VendorClient.OrderLine(
                        item.subtotal() == null ? BigDecimal.ZERO : item.subtotal(),
                        item.placedAt()))
                .toList();
        VendorClient.CommercialTermsQuote feeQuote = vendorClient.quoteCommercialTerms(
                request.getVendorId(),
                request.getPeriodStart(),
                request.getPeriodEnd(),
                orderLines,
                collection,
                collection);
        BigDecimal commission = feeQuote.totalFeeAmount() == null
                ? BigDecimal.ZERO
                : feeQuote.totalFeeAmount().setScale(2, RoundingMode.HALF_UP);
        if (commission.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Billing fees cannot be negative");
        }
        if (!collection && commission.compareTo(gross) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Billing fees (₹" + commission.toPlainString()
                            + ") are invalid for gross ₹" + gross.toPlainString());
        }

        List<VendorSettlementAdjustment> pendingAdjustments = collection
                ? List.of()
                : vendorSettlementAdjustmentRepository.findByVendorIdAndTownIdAndStatusOrderByCreatedAtAsc(
                        request.getVendorId(), request.getTownId(), VendorSettlementAdjustmentStatus.PENDING);
        BigDecimal claimChargebacks = pendingAdjustments.stream()
                .map(VendorSettlementAdjustment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal otherCharges = request.getOtherChargesAmount() == null
                ? BigDecimal.ZERO
                : request.getOtherChargesAmount().setScale(2, RoundingMode.HALF_UP);
        if (otherCharges.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Other charges cannot be negative");
        }
        if (otherCharges.compareTo(BigDecimal.ZERO) > 0
                && (request.getOtherChargesReason() == null || request.getOtherChargesReason().isBlank())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Reason is required when adding a penalty or other charge");
        }

        BigDecimal net;
        if (collection) {
            net = commission.add(otherCharges);
            if (net.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Nothing to collect — no monthly fee, commission, or extra charge on this batch.");
            }
        } else {
            net = gross.subtract(commission).subtract(claimChargebacks).subtract(otherCharges);
            if (net.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Deductions (claims ₹" + claimChargebacks.toPlainString()
                                + " + other ₹" + otherCharges.toPlainString()
                                + " + fees ₹" + commission.toPlainString()
                                + ") exceed gross ₹" + gross.toPlainString()
                                + ". Lower charges or include more orders.");
            }
        }

        Settlement settlement = Settlement.builder()
                .townId(request.getTownId())
                .payeeType(SettlementPayeeType.VENDOR)
                .direction(direction)
                .payeeId(request.getVendorId())
                .payeeName(request.getVendorName())
                .periodStart(request.getPeriodStart())
                .periodEnd(request.getPeriodEnd())
                .periodType(request.getPeriodType() == null
                        ? SettlementPeriodType.CUSTOM : request.getPeriodType())
                .grossAmount(gross)
                .commissionAmount(commission)
                .netAmount(net)
                .status(SettlementStatus.DRAFT)
                .build();
        settlement.setCreatedBy(actorId);
        settlement.setUpdatedBy(actorId);

        for (SettlementCandidateItem item : resolved) {
            SettlementLineItem line = SettlementLineItem.builder()
                    .settlement(settlement)
                    .orderId(item.orderId())
                    .subOrderId(item.subOrderId())
                    .orderNumber(item.orderNumber())
                    .subOrderNumber(item.subOrderNumber())
                    .lineType("ORDER")
                    .amount(item.subtotal())
                    .description(collection
                            ? "Shop-held COD — bag closed, cash stayed at vendor"
                            : "Vendor sub-order payout")
                    .build();
            line.setCreatedBy(actorId);
            line.setUpdatedBy(actorId);
            settlement.getLineItems().add(line);
        }

        if (collection && commission.compareTo(BigDecimal.ZERO) > 0) {
            SettlementLineItem feeLine = SettlementLineItem.builder()
                    .settlement(settlement)
                    .orderId(null)
                    .subOrderId(null)
                    .orderNumber(null)
                    .subOrderNumber(null)
                    .lineType("COMMISSION")
                    .amount(commission)
                    .description(feeQuote.subscriptionIncluded()
                            ? "Commission / monthly fee collected from vendor"
                            : "Commission collected from vendor")
                    .build();
            feeLine.setCreatedBy(actorId);
            feeLine.setUpdatedBy(actorId);
            settlement.getLineItems().add(feeLine);
        }

        for (VendorSettlementAdjustment adj : pendingAdjustments) {
            SettlementLineItem line = SettlementLineItem.builder()
                    .settlement(settlement)
                    .orderId(adj.getOrderId())
                    .subOrderId(adj.getSubOrderId())
                    .orderNumber(null)
                    .subOrderNumber(null)
                    .lineType("ADJUSTMENT")
                    .amount(adj.getAmount().negate())
                    .description(adj.getReason() != null && !adj.getReason().isBlank()
                            ? adj.getReason()
                            : "Claim chargeback — buyer credited")
                    .build();
            line.setCreatedBy(actorId);
            line.setUpdatedBy(actorId);
            settlement.getLineItems().add(line);
        }

        if (otherCharges.compareTo(BigDecimal.ZERO) > 0) {
            String reason = request.getOtherChargesReason().trim();
            SettlementLineItem line = SettlementLineItem.builder()
                    .settlement(settlement)
                    .orderId(null)
                    .subOrderId(null)
                    .orderNumber(null)
                    .subOrderNumber(null)
                    .lineType("OTHER_CHARGE")
                    .amount(collection ? otherCharges : otherCharges.negate())
                    .description(reason)
                    .build();
            line.setCreatedBy(actorId);
            line.setUpdatedBy(actorId);
            settlement.getLineItems().add(line);
        }

        if (request.isMarkPaid()) {
            applyPaid(settlement, actorId, request.getPayoutMethod(), request.getTransactionReference(),
                    request.getTransactionNotes(), request.getPaidAt());
        }

        Settlement saved = settlementRepository.save(settlement);
        for (VendorSettlementAdjustment adj : pendingAdjustments) {
            adj.setStatus(VendorSettlementAdjustmentStatus.APPLIED);
            adj.setAppliedSettlementId(saved.getId());
            adj.setUpdatedAt(java.time.Instant.now());
        }
        if (!pendingAdjustments.isEmpty()) {
            vendorSettlementAdjustmentRepository.saveAll(pendingAdjustments);
        }
        if (request.isMarkPaid() && collection && feeQuote.subscriptionIncluded()) {
            vendorClient.markSubscriptionCharged(request.getVendorId(), request.getPeriodEnd());
        }
        String payeeLabel = saved.getPayeeName() == null ? "" : saved.getPayeeName();
        townClient.appendAdminAudit(
                "settlements",
                collection ? "VENDOR_COLLECTION" : "VENDOR_PAYOUT",
                collection
                        ? "Collected from vendor " + payeeLabel + " ₹" + saved.getNetAmount()
                        : "Paid vendor " + payeeLabel + " ₹" + saved.getNetAmount(),
                actorId,
                saved.getTownId(),
                saved.getId());
        return toResponse(saved);
    }

    @Transactional
    public SettlementResponse markPaid(UUID actorId, UUID settlementId, MarkSettlementPaidRequest request) {
        Settlement settlement = settlementRepository.findDetailedById(settlementId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Settlement not found"));
        if (settlement.getStatus() == SettlementStatus.PAID) {
            throw new BusinessException(ErrorCode.CONFLICT, "Settlement is already paid");
        }
        applyPaid(settlement, actorId, request.getPayoutMethod(), request.getTransactionReference(),
                request.getTransactionNotes(), request.getPaidAt());
        settlement.setUpdatedBy(actorId);
        return toResponse(settlementRepository.save(settlement));
    }

    @Transactional(readOnly = true)
    public List<SettlementResponse> list(
            UUID townId,
            SettlementPayeeType payeeType,
            UUID payeeId,
            SettlementStatus status) {
        return settlementRepository.findFiltered(townId, payeeType, payeeId, status).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SettlementResponse get(UUID settlementId) {
        Settlement settlement = settlementRepository.findDetailedById(settlementId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Settlement not found"));
        return toResponse(settlement);
    }

    @Transactional(readOnly = true)
    public SettlementResponse getForVendor(UUID vendorId, UUID settlementId) {
        SettlementResponse response = get(settlementId);
        if (response.getPayeeType() != SettlementPayeeType.VENDOR
                || !response.getPayeeId().equals(vendorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Settlement does not belong to vendor");
        }
        return response;
    }

    @Transactional
    public SettlementResponse acknowledgeByVendor(UUID actorId, UUID vendorId, UUID settlementId) {
        Settlement settlement = settlementRepository.findDetailedById(settlementId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Settlement not found"));
        if (settlement.getPayeeType() != SettlementPayeeType.VENDOR
                || !settlement.getPayeeId().equals(vendorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Settlement does not belong to vendor");
        }
        if (settlement.getStatus() != SettlementStatus.PAID) {
            throw new BusinessException(ErrorCode.CONFLICT, "Only paid settlements can be acknowledged");
        }
        if (settlement.getVendorAcknowledgedAt() == null) {
            settlement.setVendorAcknowledgedAt(Instant.now());
            settlement.setVendorAcknowledgedBy(actorId);
            settlement.setUpdatedBy(actorId);
            settlement = settlementRepository.save(settlement);
        }
        return toResponse(settlement);
    }

    @Transactional(readOnly = true)
    public VendorOrderPayoutResponse lookupVendorPayouts(UUID vendorId, List<UUID> subOrderIds) {
        List<UUID> ids = subOrderIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return VendorOrderPayoutResponse.builder().items(List.of()).build();
        }
        List<SettlementLineItem> lines =
                settlementLineItemRepository.findByVendorAndSubOrderIds(vendorId, ids);
        Map<UUID, SettlementLineItem> bySubOrder = lines.stream()
                .collect(Collectors.toMap(SettlementLineItem::getSubOrderId, Function.identity(), (a, b) -> a));

        List<VendorOrderPayoutResponse.Item> items = ids.stream().map(id -> {
            SettlementLineItem line = bySubOrder.get(id);
            if (line == null) {
                return VendorOrderPayoutResponse.Item.builder()
                        .subOrderId(id)
                        .paid(false)
                        .build();
            }
            Settlement s = line.getSettlement();
            boolean paid = s.getStatus() == SettlementStatus.PAID;
            return VendorOrderPayoutResponse.Item.builder()
                    .subOrderId(line.getSubOrderId())
                    .orderId(line.getOrderId())
                    .orderNumber(line.getOrderNumber())
                    .subOrderNumber(line.getSubOrderNumber())
                    .amount(line.getAmount())
                    .paid(paid)
                    .settlementStatus(s.getStatus())
                    .settlementId(s.getId())
                    .paidAt(s.getPaidAt())
                    .payoutMethod(s.getPayoutMethod())
                    .transactionReference(s.getTransactionReference())
                    .transactionNotes(s.getTransactionNotes())
                    .periodStart(s.getPeriodStart() == null ? null : s.getPeriodStart().toString())
                    .periodEnd(s.getPeriodEnd() == null ? null : s.getPeriodEnd().toString())
                    .build();
        }).toList();

        return VendorOrderPayoutResponse.builder().items(items).build();
    }

    /**
     * Per-bag COD custodian for the vendor portal unpaid list.
     * Only returns bags owned by {@code vendorId}.
     */
    public VendorCodCashHolderResponse lookupVendorCashHolders(UUID vendorId, List<UUID> subOrderIds) {
        List<UUID> ids = subOrderIds == null
                ? List.of()
                : subOrderIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return VendorCodCashHolderResponse.builder().items(List.of()).build();
        }
        List<SettlementCandidateItem> items;
        try {
            items = orderClient.resolveSettlementSubOrders(vendorId, ids);
        } catch (RuntimeException ex) {
            items = List.of();
        }
        Map<UUID, SettlementCandidateItem> bySubOrder = items.stream()
                .collect(Collectors.toMap(SettlementCandidateItem::subOrderId, Function.identity(), (a, b) -> a));

        List<UUID> codOrderIds = items.stream()
                .filter(item -> isCod(item.paymentMethod()))
                .map(SettlementCandidateItem::orderId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Set<UUID> remitted = codOrderIds.isEmpty()
                ? Set.of()
                : new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(codOrderIds));
        Map<UUID, CodAgentHandover> handoverByOrder = loadLatestHandovers(codOrderIds);
        Map<UUID, AgentRef> deliveringAgentByOrder = safeDeliveringAgents(
                items, remitted, handoverByOrder, vendorId);

        Map<UUID, UUID> orderHubIds = new HashMap<>();
        for (Map.Entry<UUID, CodAgentHandover> entry : handoverByOrder.entrySet()) {
            if (entry.getValue() != null && entry.getValue().getHubId() != null) {
                orderHubIds.put(entry.getKey(), entry.getValue().getHubId());
            }
        }
        for (OrderLegs leg : safeDeliveryLegs(codOrderIds)) {
            if (leg.orderId() != null && leg.hubId() != null) {
                orderHubIds.putIfAbsent(leg.orderId(), leg.hubId());
            }
        }
        Map<UUID, String> hubNames = new HashMap<>();
        for (UUID hubId : new HashSet<>(orderHubIds.values())) {
            String name = safeHubDisplayName(hubId);
            if (name != null && !name.isBlank()) {
                hubNames.put(hubId, name.trim());
            }
        }

        List<VendorCodCashHolderResponse.Item> out = ids.stream()
                .map(subOrderId -> {
                    SettlementCandidateItem item = bySubOrder.get(subOrderId);
                    if (item == null) {
                        return VendorCodCashHolderResponse.Item.builder()
                                .subOrderId(subOrderId)
                                .holderRole("UNKNOWN")
                                .holderLabel("—")
                                .build();
                    }
                    boolean cod = isCod(item.paymentMethod());
                    String location = cod
                            ? resolveCodCashLocation(item.orderId(), remitted, handoverByOrder)
                            : "ONLINE";
                    AgentRef agent = "WITH_AGENT".equals(location)
                            ? deliveringAgentByOrder.get(item.orderId())
                            : null;
                    UUID hubId = orderHubIds.get(item.orderId());
                    String hubName = hubId == null ? null : hubNames.get(hubId);
                    VendorCodCashHolderLabels.View view = VendorCodCashHolderLabels.describe(
                            item.paymentMethod(),
                            item.vendorAgentDelivery(),
                            location,
                            agent != null ? agent.name() : null,
                            hubName);
                    return VendorCodCashHolderResponse.Item.builder()
                            .subOrderId(item.subOrderId())
                            .orderId(item.orderId())
                            .paymentMethod(item.paymentMethod())
                            .vendorAgentDelivery(item.vendorAgentDelivery())
                            .codCashLocation(location)
                            .holderRole(view.holderRole())
                            .holderLabel(view.holderLabel())
                            .holderDetail(view.holderDetail())
                            .agentId(agent != null ? agent.agentId() : null)
                            .agentName(agent != null ? agent.name() : null)
                            .agentPhone(agent != null ? agent.phone() : null)
                            .hubId(hubId)
                            .hubName(hubName)
                            .build();
                })
                .toList();
        return VendorCodCashHolderResponse.builder().items(out).build();
    }

    /** Super-admin orders list: who holds buyer COD cash per order. */
    public VendorCodCashHolderResponse lookupAdminCashHolders(List<UUID> orderIds) {
        List<UUID> ids = orderIds == null
                ? List.of()
                : orderIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return VendorCodCashHolderResponse.builder().items(List.of()).build();
        }
        List<OrderClient.CashHolderContext> contexts;
        try {
            contexts = orderClient.resolveCashHolderContext(ids);
        } catch (RuntimeException ex) {
            contexts = List.of();
        }
        List<SettlementCandidateItem> pseudo = contexts.stream()
                .map(ctx -> new SettlementCandidateItem(
                        null,
                        ctx.orderId(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        ctx.paymentMethod(),
                        ctx.vendorAgentDelivery(),
                        BigDecimal.ZERO))
                .toList();

        List<UUID> codOrderIds = pseudo.stream()
                .filter(item -> isCod(item.paymentMethod()))
                .map(SettlementCandidateItem::orderId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Set<UUID> remitted = codOrderIds.isEmpty()
                ? Set.of()
                : new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(codOrderIds));
        Map<UUID, CodAgentHandover> handoverByOrder = loadLatestHandovers(codOrderIds);

        Map<UUID, UUID> orderVendorIds = new HashMap<>();
        for (OrderClient.CashHolderContext ctx : contexts) {
            if (ctx.orderId() != null && ctx.vendorId() != null) {
                orderVendorIds.put(ctx.orderId(), ctx.vendorId());
            }
        }
        Map<UUID, AgentRef> deliveringAgentByOrder = new HashMap<>();
        for (UUID orderId : codOrderIds) {
            UUID vendorId = orderVendorIds.get(orderId);
            Map<UUID, AgentRef> one = safeDeliveringAgents(
                    pseudo.stream().filter(p -> orderId.equals(p.orderId())).toList(),
                    remitted,
                    handoverByOrder,
                    vendorId);
            AgentRef agent = one.get(orderId);
            if (agent != null) {
                deliveringAgentByOrder.put(orderId, agent);
            }
        }

        Map<UUID, UUID> orderHubIds = new HashMap<>();
        for (Map.Entry<UUID, CodAgentHandover> entry : handoverByOrder.entrySet()) {
            if (entry.getValue() != null && entry.getValue().getHubId() != null) {
                orderHubIds.put(entry.getKey(), entry.getValue().getHubId());
            }
        }
        for (OrderLegs leg : safeDeliveryLegs(codOrderIds)) {
            if (leg.orderId() != null && leg.hubId() != null) {
                orderHubIds.putIfAbsent(leg.orderId(), leg.hubId());
            }
        }
        Map<UUID, String> hubNames = new HashMap<>();
        for (UUID hubId : new HashSet<>(orderHubIds.values())) {
            String name = safeHubDisplayName(hubId);
            if (name != null && !name.isBlank()) {
                hubNames.put(hubId, name.trim());
            }
        }

        List<VendorCodCashHolderResponse.Item> out = contexts.stream()
                .map(ctx -> {
                    if (ctx.orderId() == null) {
                        return null;
                    }
                    boolean cod = isCod(ctx.paymentMethod());
                    String location = cod
                            ? resolveCodCashLocation(ctx.orderId(), remitted, handoverByOrder)
                            : "ONLINE";
                    AgentRef agent = "WITH_AGENT".equals(location)
                            ? deliveringAgentByOrder.get(ctx.orderId())
                            : null;
                    UUID hubId = orderHubIds.get(ctx.orderId());
                    String hubName = hubId == null ? null : hubNames.get(hubId);
                    VendorCodCashHolderLabels.View view = VendorCodCashHolderLabels.describe(
                            ctx.paymentMethod(),
                            ctx.vendorAgentDelivery(),
                            location,
                            agent != null ? agent.name() : null,
                            hubName);
                    return VendorCodCashHolderResponse.Item.builder()
                            .subOrderId(null)
                            .orderId(ctx.orderId())
                            .paymentMethod(ctx.paymentMethod())
                            .vendorAgentDelivery(ctx.vendorAgentDelivery())
                            .codCashLocation(location)
                            .holderRole(view.holderRole())
                            .holderLabel(view.holderLabel())
                            .holderDetail(view.holderDetail())
                            .agentId(agent != null ? agent.agentId() : null)
                            .agentName(agent != null ? agent.name() : null)
                            .agentPhone(agent != null ? agent.phone() : null)
                            .hubId(hubId)
                            .hubName(hubName)
                            .build();
                })
                .filter(Objects::nonNull)
                .toList();
        return VendorCodCashHolderResponse.builder().items(out).build();
    }

    private void applyPaid(
            Settlement settlement,
            UUID actorId,
            String payoutMethod,
            String transactionReference,
            String transactionNotes,
            Instant paidAt) {
        if (payoutMethod == null || payoutMethod.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "payoutMethod is required when marking paid");
        }
        if (transactionReference == null || transactionReference.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Txn ref is required when marking paid (UTR / UPI / cheque number)");
        }
        settlement.setStatus(SettlementStatus.PAID);
        settlement.setPayoutMethod(payoutMethod.trim().toUpperCase(Locale.ROOT));
        settlement.setTransactionReference(transactionReference.trim());
        settlement.setTransactionNotes(transactionNotes);
        settlement.setPaidAt(paidAt == null ? Instant.now() : paidAt);
        settlement.setPaidBy(actorId);
        if (settlement.getPayeeType() == SettlementPayeeType.VENDOR
                && (settlement.getServiceInvoiceNumber() == null
                || settlement.getServiceInvoiceNumber().isBlank())) {
            settlement.setServiceInvoiceNumber(serviceInvoiceNumberService.allocate(settlement.getPaidAt()));
        }
    }

    private SettlementResponse toResponse(Settlement settlement) {
        List<SettlementResponse.Line> lines = settlement.getLineItems() == null ? List.of()
                : settlement.getLineItems().stream()
                .sorted(Comparator.comparing(SettlementLineItem::getSubOrderNumber,
                        Comparator.nullsLast(String::compareTo)))
                .map(line -> SettlementResponse.Line.builder()
                        .id(line.getId())
                        .orderId(line.getOrderId())
                        .subOrderId(line.getSubOrderId())
                        .orderNumber(line.getOrderNumber())
                        .subOrderNumber(line.getSubOrderNumber())
                        .lineType(line.getLineType())
                        .amount(line.getAmount())
                        .description(line.getDescription())
                        .build())
                .toList();

        BigDecimal commission = settlement.getCommissionAmount() == null
                ? BigDecimal.ZERO : settlement.getCommissionAmount();
        BigDecimal gross = settlement.getGrossAmount() == null
                ? BigDecimal.ZERO : settlement.getGrossAmount();
        BigDecimal net = settlement.getNetAmount() == null
                ? BigDecimal.ZERO : settlement.getNetAmount();
        BigDecimal claimFromLines = sumAbsByLineType(lines, "ADJUSTMENT");
        BigDecimal otherFromLines = sumAbsByLineType(lines, "OTHER_CHARGE")
                .add(sumAbsByLineType(lines, "PENALTY"));
        BigDecimal claimChargebacks = claimFromLines;
        if (claimFromLines.compareTo(BigDecimal.ZERO) == 0 && otherFromLines.compareTo(BigDecimal.ZERO) == 0) {
            // Legacy settlements: residual before typed OTHER_CHARGE lines existed.
            claimChargebacks = gross.subtract(commission).subtract(net).max(BigDecimal.ZERO);
        }

        return SettlementResponse.builder()
                .id(settlement.getId())
                .townId(settlement.getTownId())
                .payeeType(settlement.getPayeeType())
                .direction(settlement.getDirection() == null
                        ? SettlementDirection.PAYOUT : settlement.getDirection())
                .payeeId(settlement.getPayeeId())
                .payeeName(payeeDisplayNameService.forSettlement(settlement))
                .periodStart(settlement.getPeriodStart())
                .periodEnd(settlement.getPeriodEnd())
                .periodType(settlement.getPeriodType())
                .grossAmount(settlement.getGrossAmount())
                .commissionAmount(settlement.getCommissionAmount())
                .claimChargebacksAmount(claimChargebacks)
                .otherChargesAmount(otherFromLines)
                .netAmount(settlement.getNetAmount())
                .status(settlement.getStatus())
                .payoutMethod(settlement.getPayoutMethod())
                .transactionReference(settlement.getTransactionReference())
                .transactionNotes(settlement.getTransactionNotes())
                .paidAt(settlement.getPaidAt())
                .paidBy(settlement.getPaidBy())
                .serviceInvoiceNumber(settlement.getServiceInvoiceNumber())
                .vendorAcknowledgedAt(settlement.getVendorAcknowledgedAt())
                .createdAt(settlement.getCreatedAt())
                .lines(lines)
                .build();
    }

    private static BigDecimal sumAbsByLineType(List<SettlementResponse.Line> lines, String lineType) {
        return lines.stream()
                .filter(line -> lineType.equalsIgnoreCase(line.getLineType()))
                .map(SettlementResponse.Line::getAmount)
                .filter(Objects::nonNull)
                .map(BigDecimal::abs)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Map<UUID, CodAgentHandover> loadLatestHandovers(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, CodAgentHandover> latest = new HashMap<>();
        for (CodAgentHandoverLine line : codAgentHandoverLineRepository.findWithHandoverForOrders(orderIds)) {
            if (line.getOrderId() == null || line.getHandover() == null) {
                continue;
            }
            latest.merge(line.getOrderId(), line.getHandover(), (a, b) -> {
                Instant at = a.getCreatedAt() != null ? a.getCreatedAt() : Instant.EPOCH;
                Instant bt = b.getCreatedAt() != null ? b.getCreatedAt() : Instant.EPOCH;
                return bt.isAfter(at) ? b : a;
            });
        }
        return latest;
    }

    private static String resolveCodCashLocation(
            UUID orderId,
            Set<UUID> codRemittedOrderIds,
            Map<UUID, CodAgentHandover> handoverByOrder) {
        if (orderId == null) {
            return "WITH_AGENT";
        }
        CodAgentHandover handover = handoverByOrder.get(orderId);
        if (handover != null) {
            CodAgentHandoverStatus status = handover.getStatus();
            CodCustodianType custodian = handover.getCustodianType();
            if (status == CodAgentHandoverStatus.CONFIRMED) {
                return custodian == CodCustodianType.VENDOR ? "WITH_VENDOR" : "AT_HUB";
            }
            if (status == CodAgentHandoverStatus.DECLARED || status == CodAgentHandoverStatus.DISCREPANCY) {
                return custodian == CodCustodianType.VENDOR ? "DECLARED_TO_VENDOR" : "DECLARED_TO_HUB";
            }
        }
        if (codRemittedOrderIds.contains(orderId)) {
            return "AT_HUB";
        }
        return "WITH_AGENT";
    }

    private Map<UUID, AgentRef> safeDeliveringAgents(
            List<SettlementCandidateItem> rawItems,
            Set<UUID> codRemittedOrderIds,
            Map<UUID, CodAgentHandover> handoverByOrder,
            UUID vendorId) {
        try {
            return resolveDeliveringAgents(rawItems, codRemittedOrderIds, handoverByOrder, vendorId);
        } catch (RuntimeException ex) {
            return Map.of();
        }
    }

    private List<OrderLegs> safeDeliveryLegs(Collection<UUID> orderIds) {
        try {
            return deliveryClient.resolveDeliveryLegs(orderIds);
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    private String safeHubDisplayName(UUID hubId) {
        try {
            return deliveryClient.getHubDisplayName(hubId);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private Map<UUID, AgentRef> resolveDeliveringAgents(
            List<SettlementCandidateItem> rawItems,
            Set<UUID> codRemittedOrderIds,
            Map<UUID, CodAgentHandover> handoverByOrder,
            UUID vendorId) {
        List<UUID> withAgentOrders = rawItems.stream()
                .filter(item -> isCod(item.paymentMethod()))
                .filter(item -> "WITH_AGENT".equals(resolveCodCashLocation(
                        item.orderId(), codRemittedOrderIds, handoverByOrder)))
                .map(SettlementCandidateItem::orderId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (withAgentOrders.isEmpty()) {
            return Map.of();
        }

        List<OrderLegs> legs = deliveryClient.resolveDeliveryLegs(withAgentOrders);
        Map<UUID, UUID> orderToAgentId = new HashMap<>();
        for (OrderLegs leg : legs) {
            if (leg.agentId() == null) {
                continue;
            }
            orderToAgentId.putIfAbsent(leg.orderId(), leg.agentId());
        }

        Map<UUID, AgentSummary> agentById = new HashMap<>();
        for (AgentSummary summary : deliveryClient.listVendorAgents(vendorId)) {
            if (summary.agentId() != null) {
                agentById.put(summary.agentId(), summary);
            }
        }
        legs.stream()
                .map(OrderLegs::hubId)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(hubId -> {
                    for (AgentSummary summary : deliveryClient.listHubAgents(hubId)) {
                        if (summary.agentId() != null) {
                            agentById.putIfAbsent(summary.agentId(), summary);
                        }
                    }
                });

        Map<UUID, AgentRef> out = new HashMap<>();
        for (UUID orderId : withAgentOrders) {
            UUID agentId = orderToAgentId.get(orderId);
            if (agentId == null) {
                continue;
            }
            AgentSummary summary = agentById.get(agentId);
            String name = summary != null ? summary.name() : null;
            String phone = summary != null ? summary.phone() : null;
            out.put(
                    orderId,
                    new AgentRef(
                            agentId,
                            name != null && !name.isBlank() ? name : "Delivery agent",
                            phone != null && !phone.isBlank() ? phone.trim() : null));
        }
        return out;
    }

    private record AgentRef(UUID agentId, String name, String phone) {
    }

    private Map<UUID, String> cashLocationsFor(List<SettlementCandidateItem> items) {
        List<UUID> codOrderIds = items.stream()
                .filter(item -> isCod(item.paymentMethod()))
                .map(SettlementCandidateItem::orderId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (codOrderIds.isEmpty()) {
            return Map.of();
        }
        Set<UUID> remitted = new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(codOrderIds));
        Map<UUID, CodAgentHandover> handoverByOrder = loadLatestHandovers(codOrderIds);
        Map<UUID, String> out = new HashMap<>();
        for (UUID orderId : codOrderIds) {
            out.put(orderId, resolveCodCashLocation(orderId, remitted, handoverByOrder));
        }
        return out;
    }

    /**
     * Shop (or shop staff) already holds buyer COD — do not pay GMV; collect fees instead.
     * Online, hub-held, and hub-agent COD stay on KoyaKart-pays-vendor.
     */
    static boolean vendorHoldsBuyerCash(
            boolean vendorAgentDelivery, String paymentMethod, String cashLocation) {
        if (!isCod(paymentMethod)) {
            return false;
        }
        String loc = cashLocation == null || cashLocation.isBlank() ? "WITH_AGENT" : cashLocation;
        if ("WITH_VENDOR".equals(loc) || "DECLARED_TO_VENDOR".equals(loc)) {
            return true;
        }
        if (vendorAgentDelivery) {
            return !"AT_HUB".equals(loc) && !"DECLARED_TO_HUB".equals(loc);
        }
        return false;
    }

    private static boolean isCod(String paymentMethod) {
        return paymentMethod != null && "COD".equalsIgnoreCase(paymentMethod.trim());
    }
}
