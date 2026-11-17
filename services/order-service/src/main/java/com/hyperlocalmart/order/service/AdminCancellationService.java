package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.security.PlatformAdminRoles;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.beauty.BeautyOrderStatus;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus;
import com.hyperlocalmart.order.dto.response.AdminCancellationBuyerRiskResponse;
import com.hyperlocalmart.order.dto.response.AdminCancellationVendorRiskResponse;
import com.hyperlocalmart.order.dto.response.AdminCancellationKind;
import com.hyperlocalmart.order.dto.response.AdminCancellationResponses.AdminCancellationRowResponse;
import com.hyperlocalmart.order.dto.response.AdminCancellationResponses.Initiator;
import com.hyperlocalmart.order.dto.response.AdminCancellationVertical;
import com.hyperlocalmart.order.entity.BeautyOrder;
import com.hyperlocalmart.order.entity.DiagnosticsOrder;
import com.hyperlocalmart.order.entity.LaundryOrder;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.laundry.LaundryOrderStatus;
import com.hyperlocalmart.order.repository.BeautyOrderRepository;
import com.hyperlocalmart.order.repository.DiagnosticsOrderRepository;
import com.hyperlocalmart.order.repository.LaundryOrderRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminCancellationService {

    public static AdminCancellationKind parseKind(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "kind is required (FULL or PARTIAL)");
        }
        try {
            return AdminCancellationKind.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "kind must be FULL or PARTIAL");
        }
    }

    public static AdminCancellationVertical parseVertical(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return AdminCancellationVertical.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown vertical filter");
        }
    }

    public static Initiator parseInitiator(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Initiator.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "initiatedBy must be BUYER, VENDOR, PLATFORM, or UNKNOWN");
        }
    }

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 90;
    private static final int MAX_PAGE_SIZE = 50;
    private static final int MAX_EXPORT_ROWS = 2000;

    private final OrderRepository orderRepository;
    private final BeautyOrderRepository beautyOrderRepository;
    private final LaundryOrderRepository laundryOrderRepository;
    private final DiagnosticsOrderRepository diagnosticsOrderRepository;
    private final DeliveryClient deliveryClient;
    private final PaymentClient paymentClient;

    @Transactional(readOnly = true)
    public PageResponse<AdminCancellationRowResponse> listCancellations(
            UUID actorUserId,
            List<String> roles,
            UUID townId,
            AdminCancellationKind kind,
            AdminCancellationVertical verticalFilter,
            Initiator initiatedByFilter,
            LocalDate from,
            LocalDate to,
            int page,
            int size) {
        Instant[] range = resolveRange(from, to);
        validateTownAccess(actorUserId, roles, townId);
        if (kind == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "kind is required (FULL or PARTIAL)");
        }

        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        List<AdminCancellationRowResponse> rows = attachVendorPenaltyFlags(filterByInitiator(
                buildRows(townId, kind, verticalFilter, range[0], range[1]), initiatedByFilter));
        return paginateList(rows, pageIndex, pageSize);
    }

    @Transactional(readOnly = true)
    public List<AdminCancellationRowResponse> exportCancellations(
            UUID actorUserId,
            List<String> roles,
            UUID townId,
            AdminCancellationKind kind,
            AdminCancellationVertical verticalFilter,
            Initiator initiatedByFilter,
            LocalDate from,
            LocalDate to) {
        Instant[] range = resolveRange(from, to);
        validateTownAccess(actorUserId, roles, townId);
        if (kind == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "kind is required (FULL or PARTIAL)");
        }
        List<AdminCancellationRowResponse> rows = attachVendorPenaltyFlags(filterByInitiator(
                buildRows(townId, kind, verticalFilter, range[0], range[1]), initiatedByFilter));
        return rows.size() <= MAX_EXPORT_ROWS ? rows : rows.subList(0, MAX_EXPORT_ROWS);
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminCancellationBuyerRiskResponse> listBuyerRisks(
            UUID actorUserId,
            List<String> roles,
            UUID townId,
            LocalDate from,
            LocalDate to,
            int page,
            int size) {
        Instant[] range = resolveRange(from, to);
        validateTownAccess(actorUserId, roles, townId);
        List<AdminCancellationRowResponse> full = buildRows(
                townId, AdminCancellationKind.FULL, null, range[0], range[1]);
        List<AdminCancellationRowResponse> partial = buildRows(
                townId, AdminCancellationKind.PARTIAL, AdminCancellationVertical.GROCERY, range[0], range[1]);

        Map<UUID, BuyerRiskAgg> byBuyer = new LinkedHashMap<>();
        for (AdminCancellationRowResponse row : full) {
            if (row.getBuyerId() == null) {
                continue;
            }
            BuyerRiskAgg agg = byBuyer.computeIfAbsent(row.getBuyerId(), id -> new BuyerRiskAgg(row.getBuyerId(), row.getBuyerPhone()));
            agg.fullCancelCount++;
            agg.totalLost = agg.totalLost.add(nz(row.getCancelledAmount()));
            agg.lastAt = maxInstant(agg.lastAt, row.getOccurredAt());
        }
        for (AdminCancellationRowResponse row : partial) {
            if (row.getBuyerId() == null) {
                continue;
            }
            BuyerRiskAgg agg = byBuyer.computeIfAbsent(row.getBuyerId(), id -> new BuyerRiskAgg(row.getBuyerId(), row.getBuyerPhone()));
            agg.partialCancelCount++;
            agg.totalLost = agg.totalLost.add(nz(row.getCancelledAmount()));
            agg.lastAt = maxInstant(agg.lastAt, row.getOccurredAt());
            if (row.getInitiatedBy() == Initiator.VENDOR
                    || (row.getSummary() != null && row.getSummary().toLowerCase(Locale.ROOT).contains("shop reject"))) {
                agg.vendorRejectEvents++;
            }
            if (row.getBuyerPhone() != null && agg.phone == null) {
                agg.phone = row.getBuyerPhone();
            }
        }

        List<AdminCancellationBuyerRiskResponse> ranked = byBuyer.values().stream()
                .map(this::toBuyerRisk)
                .sorted(Comparator
                        .comparingInt((AdminCancellationBuyerRiskResponse r) -> riskWeight(r.getRiskLevel()))
                        .reversed()
                        .thenComparing(AdminCancellationBuyerRiskResponse::getTotalLostAmount, Comparator.reverseOrder()))
                .toList();

        return paginateList(ranked, Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminCancellationVendorRiskResponse> listVendorRisks(
            UUID actorUserId,
            List<String> roles,
            UUID townId,
            LocalDate from,
            LocalDate to,
            int page,
            int size) {
        Instant[] range = resolveRange(from, to);
        validateTownAccess(actorUserId, roles, townId);
        List<AdminCancellationRowResponse> full = buildRows(
                townId, AdminCancellationKind.FULL, null, range[0], range[1]);
        List<AdminCancellationRowResponse> partial = buildRows(
                townId, AdminCancellationKind.PARTIAL, AdminCancellationVertical.GROCERY, range[0], range[1]);

        Map<UUID, VendorRiskAgg> byVendor = new LinkedHashMap<>();
        for (AdminCancellationRowResponse row : full) {
            if (row.getVendorId() == null || row.getInitiatedBy() != Initiator.VENDOR) {
                continue;
            }
            VendorRiskAgg agg = byVendor.computeIfAbsent(
                    row.getVendorId(),
                    id -> new VendorRiskAgg(row.getVendorId(), row.getCounterpartyName()));
            agg.fullVendorCancelCount++;
            agg.totalLost = agg.totalLost.add(nz(row.getCancelledAmount()));
            agg.lastAt = maxInstant(agg.lastAt, row.getOccurredAt());
            if (agg.name == null && row.getCounterpartyName() != null) {
                agg.name = row.getCounterpartyName();
            }
        }
        for (AdminCancellationRowResponse row : partial) {
            if (row.getVendorId() == null) {
                continue;
            }
            VendorRiskAgg agg = byVendor.computeIfAbsent(
                    row.getVendorId(),
                    id -> new VendorRiskAgg(row.getVendorId(), row.getCounterpartyName()));
            if (row.getInitiatedBy() == Initiator.VENDOR) {
                agg.shopRejectCount++;
            } else if (row.getInitiatedBy() == Initiator.BUYER) {
                agg.buyerBagCancelCount++;
            }
            if (row.getInitiatedBy() == Initiator.VENDOR) {
                agg.totalLost = agg.totalLost.add(nz(row.getCancelledAmount()));
            }
            agg.lastAt = maxInstant(agg.lastAt, row.getOccurredAt());
            if (agg.name == null && row.getCounterpartyName() != null) {
                agg.name = row.getCounterpartyName();
            }
        }

        List<AdminCancellationVendorRiskResponse> ranked = byVendor.values().stream()
                .filter(v -> v.fullVendorCancelCount > 0 || v.shopRejectCount > 0)
                .map(this::toVendorRisk)
                .sorted(Comparator
                        .comparingInt((AdminCancellationVendorRiskResponse r) -> riskWeight(r.getRiskLevel()))
                        .reversed()
                        .thenComparing(AdminCancellationVendorRiskResponse::getTotalLostAmount, Comparator.reverseOrder()))
                .toList();

        return paginateList(ranked, Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
    }

    private List<AdminCancellationRowResponse> buildRows(
            UUID townId,
            AdminCancellationKind kind,
            AdminCancellationVertical verticalFilter,
            Instant start,
            Instant end) {
        if (townId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "townId is required");
        }
        List<AdminCancellationRowResponse> rows = new ArrayList<>();
        if (kind == AdminCancellationKind.FULL) {
            if (verticalFilter == null || verticalFilter == AdminCancellationVertical.GROCERY) {
                rows.addAll(groceryFullRows(townId, start, end));
            }
            if (verticalFilter == null || verticalFilter == AdminCancellationVertical.BEAUTY) {
                rows.addAll(beautyFullRows(townId, start, end));
            }
            if (verticalFilter == null || verticalFilter == AdminCancellationVertical.LAUNDRY) {
                rows.addAll(laundryFullRows(townId, start, end));
            }
            if (verticalFilter == null || verticalFilter == AdminCancellationVertical.DIAGNOSTICS) {
                rows.addAll(diagnosticsFullRows(townId, start, end));
            }
        } else if (verticalFilter == null || verticalFilter == AdminCancellationVertical.GROCERY) {
            rows.addAll(groceryPartialRows(townId, start, end));
        }
        rows.sort(Comparator.comparing(
                AdminCancellationRowResponse::getOccurredAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return rows;
    }

    private Instant[] resolveRange(LocalDate from, LocalDate to) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo.minusDays(29);
        if (rangeFrom.isAfter(rangeTo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from must be on or before to");
        }
        if (ChronoUnit.DAYS.between(rangeFrom, rangeTo) + 1 > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
        return new Instant[] {
                rangeFrom.atStartOfDay(IST).toInstant(),
                rangeTo.plusDays(1).atStartOfDay(IST).toInstant()
        };
    }

    private List<AdminCancellationRowResponse> attachVendorPenaltyFlags(List<AdminCancellationRowResponse> rows) {
        if (rows == null || rows.isEmpty()) {
            return rows == null ? List.of() : rows;
        }
        List<PaymentClient.CancellationPenaltyOrderRef> refs = rows.stream()
                .filter(r -> r.getOrderId() != null)
                .map(r -> new PaymentClient.CancellationPenaltyOrderRef(r.getOrderId(), r.getOrderNumber()))
                .distinct()
                .toList();
        if (refs.isEmpty()) {
            return rows;
        }
        Set<UUID> penalized = paymentClient.findCancellationPenaltyOrderIds(refs);
        if (penalized.isEmpty()) {
            return rows;
        }
        return rows.stream()
                .map(r -> penalized.contains(r.getOrderId())
                        ? r.toBuilder().vendorPenaltySent(true).build()
                        : r)
                .toList();
    }

    private static List<AdminCancellationRowResponse> filterByInitiator(
            List<AdminCancellationRowResponse> rows,
            Initiator initiatedByFilter) {
        if (initiatedByFilter == null) {
            return rows;
        }
        return rows.stream().filter(r -> r.getInitiatedBy() == initiatedByFilter).toList();
    }

    private AdminCancellationVendorRiskResponse toVendorRisk(VendorRiskAgg agg) {
        int score = agg.fullVendorCancelCount * 3 + agg.shopRejectCount * 2;
        String level = score >= 8 || agg.shopRejectCount >= 5 ? "HIGH"
                : score >= 4 || agg.shopRejectCount >= 2 ? "MEDIUM"
                : "LOW";
        String summary = agg.fullVendorCancelCount + " full vendor cancel(s), " + agg.shopRejectCount + " shop reject(s)";
        if (agg.buyerBagCancelCount > 0) {
            summary += ", " + agg.buyerBagCancelCount + " buyer bag cancel(s) at shop";
        }
        return AdminCancellationVendorRiskResponse.builder()
                .vendorId(agg.vendorId)
                .vendorName(agg.name)
                .fullVendorCancelCount(agg.fullVendorCancelCount)
                .shopRejectCount(agg.shopRejectCount)
                .buyerBagCancelCount(agg.buyerBagCancelCount)
                .totalLostAmount(agg.totalLost)
                .lastOccurredAt(agg.lastAt)
                .riskLevel(level)
                .summary(summary)
                .build();
    }

    private AdminCancellationBuyerRiskResponse toBuyerRisk(BuyerRiskAgg agg) {
        int score = agg.fullCancelCount * 3 + agg.partialCancelCount + agg.vendorRejectEvents * 2;
        String level = score >= 8 || agg.fullCancelCount >= 4 ? "HIGH"
                : score >= 4 || agg.partialCancelCount >= 3 ? "MEDIUM"
                : "LOW";
        String summary = agg.fullCancelCount + " full, " + agg.partialCancelCount + " partial grocery event(s)";
        return AdminCancellationBuyerRiskResponse.builder()
                .buyerId(agg.buyerId)
                .buyerPhone(agg.phone)
                .fullCancelCount(agg.fullCancelCount)
                .partialCancelCount(agg.partialCancelCount)
                .vendorRejectEvents(agg.vendorRejectEvents)
                .totalLostAmount(agg.totalLost)
                .lastOccurredAt(agg.lastAt)
                .riskLevel(level)
                .summary(summary)
                .build();
    }

    private List<AdminCancellationRowResponse> groceryFullRows(UUID townId, Instant start, Instant end) {
        List<AdminCancellationRowResponse> out = new ArrayList<>();
        for (Order order : orderRepository.findGroceryFullyCancelledByTownAndCancelledAtBetween(townId, start, end)) {
            List<String> hints = new ArrayList<>();
            BigDecimal collected = prepaidExposure(order);
            if (collected.compareTo(BigDecimal.ZERO) > 0) {
                hints.add("Online payment ₹" + collected.stripTrailingZeros().toPlainString()
                        + " — verify refund / wallet reversal");
            }
            if (order.getPaymentMethod() != null && "COD".equalsIgnoreCase(order.getPaymentMethod().name())) {
                hints.add("COD order — check store credit issued to buyer");
            }
            hints.add("Review vendor cancel rate if shop-driven");

            out.add(AdminCancellationRowResponse.builder()
                    .kind(AdminCancellationKind.FULL)
                    .vertical(AdminCancellationVertical.GROCERY)
                    .orderId(order.getId())
                    .orderNumber(order.getOrderNumber())
                    .townId(order.getTownId())
                    .buyerId(order.getBuyerId())
                    .buyerPhone(order.getBuyerPhoneSnapshot())
                    .vendorId(primaryVendorId(order))
                    .shopId(primaryShopId(order))
                    .counterpartyName(primaryShopName(order))
                    .orderStatus(order.getStatus().name())
                    .paymentMethod(order.getPaymentMethod() == null ? null : order.getPaymentMethod().name())
                    .paymentStatus(order.getPaymentStatus() == null ? null : order.getPaymentStatus().name())
                    .orderTotal(OrderService.buyerPayableTotal(order))
                    .cancelledAmount(OrderService.buyerPayableTotal(order))
                    .platformFee(nz(order.getPlatformFee()))
                    .amountCollected(collected)
                    .occurredAt(order.getCancelledAt())
                    .reason(trimToNull(order.getCancelReason()))
                    .initiatedBy(guessGroceryInitiator(order.getCancelReason()))
                    .summary("Entire grocery order cancelled")
                    .actionHints(hints)
                    .adminPath("/orders/" + order.getId() + "?townId=" + order.getTownId())
                    .build());
        }
        return out;
    }

    private List<AdminCancellationRowResponse> groceryPartialRows(UUID townId, Instant start, Instant end) {
        List<UUID> orderIds = orderRepository.findGroceryPartialCancellationOrderIds(townId, start, end);
        if (orderIds.isEmpty()) {
            return List.of();
        }
        List<AdminCancellationRowResponse> out = new ArrayList<>();
        for (Order order : orderRepository.findAllWithSubOrdersByIdIn(orderIds)) {
            PartialGrocerySnapshot snap = partialGrocerySnapshot(order, start, end);
            if (snap.occurredAt == null) {
                continue;
            }
            List<String> hints = new ArrayList<>();
            if (snap.vendorRejectedBags > 0) {
                hints.add(snap.vendorRejectedBags + " vendor reject(s) — SLA / penalty review");
            }
            if (snap.buyerCancelledBags > 0) {
                hints.add(snap.buyerCancelledBags + " buyer-cancelled shop bag(s)");
            }
            if (snap.cancelledUnits > 0) {
                hints.add(snap.cancelledUnits + " item unit(s) removed — refunds / store credit");
            }
            hints.add("Master order still " + order.getStatus().name().toLowerCase(Locale.ROOT) + " — partial fulfillment");

            out.add(AdminCancellationRowResponse.builder()
                    .kind(AdminCancellationKind.PARTIAL)
                    .vertical(AdminCancellationVertical.GROCERY)
                    .orderId(order.getId())
                    .orderNumber(order.getOrderNumber())
                    .townId(order.getTownId())
                    .buyerId(order.getBuyerId())
                    .buyerPhone(order.getBuyerPhoneSnapshot())
                    .vendorId(snap.primaryVendorId)
                    .shopId(snap.primaryShopId)
                    .counterpartyName(snap.primaryShopName)
                    .orderStatus(order.getStatus().name())
                    .paymentMethod(order.getPaymentMethod() == null ? null : order.getPaymentMethod().name())
                    .paymentStatus(order.getPaymentStatus() == null ? null : order.getPaymentStatus().name())
                    .orderTotal(OrderService.buyerPayableTotal(order))
                    .cancelledAmount(snap.cancelledAmount)
                    .platformFee(nz(order.getPlatformFee()))
                    .amountCollected(prepaidExposure(order))
                    .occurredAt(snap.occurredAt)
                    .reason(trimToNull(snap.primaryReason))
                    .initiatedBy(snap.initiatedBy)
                    .summary(snap.summary)
                    .actionHints(hints)
                    .adminPath("/orders/" + order.getId() + "?townId=" + order.getTownId())
                    .build());
        }
        return out;
    }

    private List<AdminCancellationRowResponse> beautyFullRows(UUID townId, Instant start, Instant end) {
        List<AdminCancellationRowResponse> out = new ArrayList<>();
        for (BeautyOrder order : beautyOrderRepository
                .findByTownIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtDesc(
                        townId, BeautyOrderStatus.CANCELLED, start, end)) {
            List<String> hints = new ArrayList<>();
            BigDecimal collected = nz(order.getAmountCollected());
            if (collected.compareTo(BigDecimal.ZERO) > 0) {
                hints.add("Prepay / online ₹" + collected.stripTrailingZeros().toPlainString()
                        + " — confirm wallet refund");
            }
            hints.add("Glam booking — review artist no-show / vendor policy");

            out.add(AdminCancellationRowResponse.builder()
                    .kind(AdminCancellationKind.FULL)
                    .vertical(AdminCancellationVertical.BEAUTY)
                    .orderId(order.getId())
                    .orderNumber(order.getOrderNumber())
                    .townId(order.getTownId())
                    .buyerId(order.getBuyerId())
                    .buyerPhone(order.getContactPhone())
                    .vendorId(order.getVendorId())
                    .counterpartyName(order.getArtistName())
                    .orderStatus(order.getStatus().name())
                    .paymentMethod(order.getPaymentMethod() == null ? null : order.getPaymentMethod().name())
                    .paymentStatus(order.getPaymentStatus() == null ? null : order.getPaymentStatus().name())
                    .orderTotal(nz(order.getAmountDueTotal()))
                    .cancelledAmount(nz(order.getAmountDueTotal()))
                    .platformFee(nz(order.getPlatformFeeAmount()))
                    .amountCollected(collected)
                    .occurredAt(order.getUpdatedAt())
                    .reason(null)
                    .initiatedBy(Initiator.UNKNOWN)
                    .summary("Glam booking fully cancelled")
                    .actionHints(hints)
                    .adminPath("/beauty")
                    .build());
        }
        return out;
    }

    private List<AdminCancellationRowResponse> laundryFullRows(UUID townId, Instant start, Instant end) {
        List<AdminCancellationRowResponse> out = new ArrayList<>();
        for (LaundryOrder order : laundryOrderRepository
                .findByTownIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtDesc(
                        townId, LaundryOrderStatus.CANCELLED, start, end)) {
            BigDecimal orderTotal = nz(order.getGoodsAmount()).add(nz(order.getLogisticsCharge()));
            List<String> hints = new ArrayList<>();
            BigDecimal collected = nz(order.getAmountCollected());
            BigDecimal wallet = nz(order.getWalletCredited());
            if (collected.compareTo(BigDecimal.ZERO) > 0) {
                hints.add("Payment collected ₹" + collected.stripTrailingZeros().toPlainString()
                        + " — verify reversal");
            }
            if (wallet.compareTo(BigDecimal.ZERO) > 0) {
                hints.add("Wallet credited ₹" + wallet.stripTrailingZeros().toPlainString());
            }
            if (order.getVendorComment() != null && !order.getVendorComment().isBlank()) {
                hints.add("Shop note on file");
            }

            Initiator initiator = order.getVendorComment() != null && order.getVendorComment().toLowerCase(Locale.ROOT).contains("reject")
                    ? Initiator.VENDOR
                    : Initiator.UNKNOWN;

            out.add(AdminCancellationRowResponse.builder()
                    .kind(AdminCancellationKind.FULL)
                    .vertical(AdminCancellationVertical.LAUNDRY)
                    .orderId(order.getId())
                    .orderNumber(order.getOrderNumber())
                    .townId(order.getTownId())
                    .buyerId(order.getBuyerId())
                    .buyerPhone(order.getContactPhone())
                    .vendorId(order.getVendorId())
                    .counterpartyName(order.getShopName())
                    .orderStatus(order.getStatus().name())
                    .paymentMethod(order.getPaymentMethod() == null ? null : order.getPaymentMethod().name())
                    .paymentStatus(order.getPaymentStatus() == null ? null : order.getPaymentStatus().name())
                    .orderTotal(orderTotal)
                    .cancelledAmount(orderTotal)
                    .platformFee(nz(order.getPlatformFeeAmount()))
                    .amountCollected(collected)
                    .occurredAt(order.getUpdatedAt())
                    .reason(trimToNull(order.getVendorComment()))
                    .initiatedBy(initiator)
                    .summary(order.getPieceCount() + " piece laundry order cancelled")
                    .actionHints(hints)
                    .adminPath("/laundry")
                    .build());
        }
        return out;
    }

    private List<AdminCancellationRowResponse> diagnosticsFullRows(UUID townId, Instant start, Instant end) {
        List<AdminCancellationRowResponse> out = new ArrayList<>();
        for (DiagnosticsOrder order : diagnosticsOrderRepository
                .findByTownIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtDesc(
                        townId, DiagnosticsOrderStatus.CANCELLED, start, end)) {
            BigDecimal orderTotal = nz(order.getTestsSubtotal())
                    .add(nz(order.getHomeCollectionFee()))
                    .add(nz(order.getPlatformFeeAmount()))
                    .add(nz(order.getCodFee()));
            List<String> hints = new ArrayList<>();
            BigDecimal collected = nz(order.getAmountCollected());
            if (collected.compareTo(BigDecimal.ZERO) > 0) {
                hints.add("Paid amount ₹" + collected.stripTrailingZeros().toPlainString()
                        + " — refund check");
            }
            hints.add("Diagnostics booking — lab slot / home collection impact");

            out.add(AdminCancellationRowResponse.builder()
                    .kind(AdminCancellationKind.FULL)
                    .vertical(AdminCancellationVertical.DIAGNOSTICS)
                    .orderId(order.getId())
                    .orderNumber(order.getOrderNumber())
                    .townId(order.getTownId())
                    .buyerId(order.getBuyerId())
                    .buyerPhone(order.getContactPhone())
                    .vendorId(order.getVendorId())
                    .counterpartyName(order.getShopName())
                    .orderStatus(order.getStatus().name())
                    .paymentMethod(order.getPaymentMethod() == null ? null : order.getPaymentMethod().name())
                    .paymentStatus(order.getPaymentStatus() == null ? null : order.getPaymentStatus().name())
                    .orderTotal(orderTotal)
                    .cancelledAmount(orderTotal)
                    .platformFee(nz(order.getPlatformFeeAmount()))
                    .amountCollected(collected)
                    .occurredAt(order.getUpdatedAt())
                    .reason(null)
                    .initiatedBy(Initiator.UNKNOWN)
                    .summary("Diagnostics booking for " + order.getPatientName() + " cancelled")
                    .actionHints(hints)
                    .adminPath("/diagnostics")
                    .build());
        }
        return out;
    }

    private static PartialGrocerySnapshot partialGrocerySnapshot(Order order, Instant start, Instant end) {
        PartialGrocerySnapshot snap = new PartialGrocerySnapshot();
        List<VendorSubOrder> subs = order.getVendorSubOrders() == null ? List.of() : order.getVendorSubOrders();
        Instant latest = null;
        for (VendorSubOrder sub : subs) {
            if (sub.getStatus() == VendorSubOrderStatus.VENDOR_REJECTED
                    && inRange(sub.getUpdatedAt(), start, end)) {
                snap.vendorRejectedBags++;
                snap.cancelledAmount = snap.cancelledAmount.add(nz(sub.getSubtotal()));
                latest = maxInstant(latest, sub.getUpdatedAt());
                if (snap.primaryReason == null) {
                    snap.primaryReason = sub.getRejectReason();
                }
                snap.initiatedBy = Initiator.VENDOR;
                if (snap.primaryVendorId == null) {
                    snap.primaryVendorId = sub.getVendorId();
                    snap.primaryShopId = sub.getShopId();
                    snap.primaryShopName = shopNameFromSub(sub);
                }
            } else if (sub.getStatus() == VendorSubOrderStatus.BUYER_CANCELLED
                    && inRange(sub.getUpdatedAt(), start, end)) {
                snap.buyerCancelledBags++;
                snap.cancelledAmount = snap.cancelledAmount.add(nz(sub.getSubtotal()));
                latest = maxInstant(latest, sub.getUpdatedAt());
                if (snap.initiatedBy != Initiator.VENDOR) {
                    snap.initiatedBy = Initiator.BUYER;
                }
                if (snap.primaryVendorId == null) {
                    snap.primaryVendorId = sub.getVendorId();
                    snap.primaryShopId = sub.getShopId();
                    snap.primaryShopName = shopNameFromSub(sub);
                }
            }
            if (sub.getItems() == null) {
                continue;
            }
            for (OrderItem item : sub.getItems()) {
                if (item.getStatus() == OrderItemStatus.CANCELLED
                        && item.getCancelledAt() != null
                        && inRange(item.getCancelledAt(), start, end)) {
                    snap.cancelledUnits += item.getQuantity();
                    snap.cancelledAmount = snap.cancelledAmount.add(nz(item.getLineTotal()));
                    latest = maxInstant(latest, item.getCancelledAt());
                    if (snap.primaryReason == null) {
                        snap.primaryReason = item.getCancelReason();
                    }
                    snap.initiatedBy = mergeInitiator(snap.initiatedBy, initiatorForCancelledItem(order, item));
                    if (snap.primaryVendorId == null) {
                        snap.primaryVendorId = sub.getVendorId();
                        snap.primaryShopId = sub.getShopId();
                        snap.primaryShopName = shopNameFromSub(sub);
                    }
                }
            }
        }
        snap.occurredAt = latest;
        List<String> parts = new ArrayList<>();
        if (snap.vendorRejectedBags > 0) {
            parts.add(snap.vendorRejectedBags + " shop reject(s)");
        }
        if (snap.buyerCancelledBags > 0) {
            parts.add(snap.buyerCancelledBags + " buyer bag cancel(s)");
        }
        if (snap.cancelledUnits > 0) {
            parts.add(snap.cancelledUnits + " item unit(s) removed");
        }
        snap.summary = parts.isEmpty() ? "Partial cancel" : String.join(", ", parts);
        return snap;
    }

    private static <T> PageResponse<T> paginateList(List<T> rows, int page, int size) {
        int total = rows.size();
        int from = Math.min(page * size, total);
        int to = Math.min(from + size, total);
        List<T> slice = from >= total ? List.of() : rows.subList(from, to);
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / size);
        return PageResponse.<T>builder()
                .items(slice)
                .page(page)
                .size(size)
                .totalElements(total)
                .totalPages(totalPages)
                .build();
    }

    private static int riskWeight(String level) {
        if ("HIGH".equalsIgnoreCase(level)) {
            return 3;
        }
        if ("MEDIUM".equalsIgnoreCase(level)) {
            return 2;
        }
        return 1;
    }

    private void validateTownAccess(UUID actorUserId, List<String> roles, UUID townId) {
        if (PlatformAdminRoles.isPlatformStaff(roles)) {
            return;
        }
        if (roles == null || !roles.contains("HUB_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or app admin role required");
        }
        DeliveryClient.HubAdminContext context = deliveryClient.getHubAdminContext(actorUserId);
        if (!context.townId().equals(townId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Town does not match hub scope");
        }
    }

    private static BigDecimal prepaidExposure(Order order) {
        if (order.getPaymentStatus() == null) {
            return BigDecimal.ZERO;
        }
        String ps = order.getPaymentStatus().name();
        if (!"PAID".equals(ps) && !"REFUNDED".equals(ps)) {
            return BigDecimal.ZERO;
        }
        return OrderService.buyerPayableTotal(order);
    }

    /** Vendor portal item cancel sets {@link OrderItem#getCancelledBy()} — not only bag reject. */
    private static Initiator initiatorForCancelledItem(Order order, OrderItem item) {
        UUID buyerId = order.getBuyerId();
        UUID cancelledBy = item.getCancelledBy();
        if (cancelledBy != null && buyerId != null) {
            return cancelledBy.equals(buyerId) ? Initiator.BUYER : Initiator.VENDOR;
        }
        String reason = item.getCancelReason();
        if (reason != null && reason.toLowerCase(Locale.ROOT).contains("buyer")) {
            return Initiator.BUYER;
        }
        if (cancelledBy != null) {
            return Initiator.VENDOR;
        }
        return Initiator.UNKNOWN;
    }

    /** Prefer vendor-led when the period mixes buyer bag cancels with shop line removals. */
    private static Initiator mergeInitiator(Initiator current, Initiator event) {
        if (event == null || event == Initiator.UNKNOWN) {
            return current;
        }
        if (current == null || current == Initiator.UNKNOWN) {
            return event;
        }
        if (current == Initiator.BUYER && event == Initiator.VENDOR) {
            return Initiator.VENDOR;
        }
        if (current == Initiator.VENDOR && event == Initiator.BUYER) {
            return Initiator.VENDOR;
        }
        return current;
    }

    private static Initiator guessGroceryInitiator(String reason) {
        if (reason == null) {
            return Initiator.UNKNOWN;
        }
        String lower = reason.toLowerCase(Locale.ROOT);
        if (lower.contains("buyer") || lower.contains("customer")) {
            return Initiator.BUYER;
        }
        if (lower.contains("vendor") || lower.contains("shop") || lower.contains("reject")) {
            return Initiator.VENDOR;
        }
        return Initiator.UNKNOWN;
    }

    private static UUID primaryVendorId(Order order) {
        if (order.getVendorSubOrders() == null || order.getVendorSubOrders().isEmpty()) {
            return null;
        }
        return order.getVendorSubOrders().getFirst().getVendorId();
    }

    private static UUID primaryShopId(Order order) {
        if (order.getVendorSubOrders() == null || order.getVendorSubOrders().isEmpty()) {
            return null;
        }
        return order.getVendorSubOrders().getFirst().getShopId();
    }

    private static String primaryShopName(Order order) {
        if (order.getVendorSubOrders() == null) {
            return null;
        }
        for (VendorSubOrder sub : order.getVendorSubOrders()) {
            String name = shopNameFromSub(sub);
            if (name != null) {
                return name;
            }
        }
        return null;
    }

    private static String shopNameFromSub(VendorSubOrder sub) {
        if (sub.getItems() == null || sub.getItems().isEmpty()) {
            return "Shop";
        }
        String name = sub.getItems().getFirst().getShopNameSnapshot();
        return name == null || name.isBlank() ? "Shop" : name;
    }

    private static boolean inRange(Instant at, Instant start, Instant end) {
        return at != null && !at.isBefore(start) && at.isBefore(end);
    }

    private static Instant maxInstant(Instant a, Instant b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.isAfter(b) ? a : b;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static final class PartialGrocerySnapshot {
        int vendorRejectedBags;
        int buyerCancelledBags;
        int cancelledUnits;
        BigDecimal cancelledAmount = BigDecimal.ZERO;
        Instant occurredAt;
        String primaryReason;
        UUID primaryVendorId;
        UUID primaryShopId;
        String primaryShopName;
        Initiator initiatedBy = Initiator.UNKNOWN;
        String summary;
    }

    private static final class BuyerRiskAgg {
        final UUID buyerId;
        String phone;
        int fullCancelCount;
        int partialCancelCount;
        int vendorRejectEvents;
        BigDecimal totalLost = BigDecimal.ZERO;
        Instant lastAt;

        BuyerRiskAgg(UUID buyerId, String phone) {
            this.buyerId = buyerId;
            this.phone = phone;
        }
    }

    private static final class VendorRiskAgg {
        final UUID vendorId;
        String name;
        int fullVendorCancelCount;
        int shopRejectCount;
        int buyerBagCancelCount;
        BigDecimal totalLost = BigDecimal.ZERO;
        Instant lastAt;

        VendorRiskAgg(UUID vendorId, String name) {
            this.vendorId = vendorId;
            this.name = name;
        }
    }
}