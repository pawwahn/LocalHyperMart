package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.beauty.BeautyOrderStatus;
import com.hyperlocalmart.order.beauty.BeautyPaymentMethod;
import com.hyperlocalmart.order.beauty.BeautyPaymentStatus;
import com.hyperlocalmart.order.beauty.BeautySettlementItems;
import com.hyperlocalmart.order.beauty.BeautySettlementMoney;
import com.hyperlocalmart.order.dto.response.SettlementCandidateResponse;
import com.hyperlocalmart.order.client.SuccessfulOnlineTotalLookup;
import com.hyperlocalmart.order.dto.response.VendorSalesReportResponse;
import com.hyperlocalmart.order.dto.response.VendorSalesReportResponse.VendorSalesReportItem;
import com.hyperlocalmart.order.dto.response.VendorSalesReportResponse.VendorSalesReportRow;
import com.hyperlocalmart.order.entity.BeautyOrder;
import com.hyperlocalmart.order.entity.LaundryOrder;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.laundry.LaundryOrderStatus;
import com.hyperlocalmart.order.laundry.LaundryPaymentMethod;
import com.hyperlocalmart.order.laundry.LaundryPaymentStatus;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.repository.BeautyOrderRepository;
import com.hyperlocalmart.order.repository.LaundryOrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Vendor sales / payout rows for every service vertical (grocery bags, laundry, glam, …).
 * New services must append rows here — Payouts and Reports read this API, not bags alone.
 */
@Service
@RequiredArgsConstructor
public class VendorSalesReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;
    private static final int ITEM_RANK_LIMIT = 10;

    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final LaundryOrderRepository laundryOrderRepository;
    private final BeautyOrderRepository beautyOrderRepository;
    private final TownClient townClient;
    private final SuccessfulOnlineTotalLookup onlinePayments;

    @Transactional(readOnly = true)
    public VendorSalesReportResponse getSalesReport(
            UUID vendorId,
            LocalDate from,
            LocalDate to,
            boolean includeItems,
            PaymentStatus paymentStatus) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo;
        validateDateRange(rangeFrom, rangeTo);

        Instant rangeStart = rangeFrom.atStartOfDay(IST).toInstant();
        Instant rangeEnd = rangeTo.plusDays(1).atStartOfDay(IST).toInstant();

        List<VendorSubOrder> subOrders = vendorSubOrderRepository.findSalesReportByVendorId(
                vendorId, rangeStart, rangeEnd, paymentStatus);
        List<UUID> orderIds = OrderSiblingBags.distinctOrderIds(subOrders);
        if (!orderIds.isEmpty()) {
            OrderSiblingBags.attach(subOrders, vendorSubOrderRepository.findByOrderIdIn(orderIds));
        }

        Map<String, Long> statusCounts = zeroStatusCounts();
        Map<String, Long> paymentStatusCounts = new HashMap<>();
        Map<String, Long> paymentMethodCounts = new HashMap<>();

        GlamSalesAccum glamAccum = new GlamSalesAccum();

        List<VendorSalesReportRow> rows = new ArrayList<>();
        Map<String, ItemAgg> itemAggs = new HashMap<>();

        for (BeautyOrder beautyOrder : beautyOrderRepository.findSalesReportByVendorId(
                vendorId, rangeStart, rangeEnd)) {
            appendBeautySalesRows(
                    beautyOrder,
                    paymentStatus,
                    includeItems,
                    rows,
                    itemAggs,
                    statusCounts,
                    paymentStatusCounts,
                    paymentMethodCounts,
                    glamAccum);
        }

        BigDecimal grossSales = glamAccum.grossSales;
        BigDecimal paidAmount = glamAccum.paidAmount;
        BigDecimal pendingAmount = glamAccum.pendingAmount;
        BigDecimal refundedAmount = glamAccum.refundedAmount;
        BigDecimal rejectedAmount = BigDecimal.ZERO;
        long itemQuantityTotal = glamAccum.itemQuantityTotal;

        for (LaundryOrder laundryOrder : laundryOrderRepository.findSalesReportByVendorId(
                vendorId, rangeStart, rangeEnd)) {
            PaymentStatus payStatus = laundryPaymentStatus(laundryOrder.getPaymentStatus());
            if (paymentStatus != null && payStatus != paymentStatus) {
                continue;
            }
            PaymentMethod payMethod = laundryOrder.getPaymentMethod() == LaundryPaymentMethod.UPI
                    ? PaymentMethod.ONLINE
                    : PaymentMethod.COD;
            boolean delivered = laundryOrder.getStatus() == LaundryOrderStatus.DELIVERED;
            statusCounts.merge(
                    delivered ? VendorSubOrderStatus.DELIVERED.name() : laundryOrder.getStatus().name(),
                    1L,
                    Long::sum);
            paymentStatusCounts.merge(payStatus.name(), 1L, Long::sum);
            paymentMethodCounts.merge(payMethod.name(), 1L, Long::sum);

            BigDecimal subtotal = laundryOrder.getGoodsAmount() != null
                    ? laundryOrder.getGoodsAmount()
                    : BigDecimal.ZERO;
            if (delivered) {
                grossSales = grossSales.add(subtotal);
                if (payStatus == PaymentStatus.PAID) {
                    paidAmount = paidAmount.add(subtotal);
                } else if (payStatus == PaymentStatus.REFUNDED) {
                    refundedAmount = refundedAmount.add(subtotal);
                } else {
                    pendingAmount = pendingAmount.add(subtotal);
                }
            }

            int itemCount = Math.max(laundryOrder.getPieceCount(), 0);
            itemQuantityTotal += itemCount;
            List<VendorSalesReportItem> items = null;
            if (includeItems) {
                items = List.of(VendorSalesReportItem.builder()
                        .name("Laundry")
                        .unit("piece")
                        .quantity(itemCount)
                        .unitPrice(null)
                        .discountPrice(null)
                        .lineTotal(subtotal)
                        .build());
            }
            if (delivered) {
                ItemAgg agg = itemAggs.computeIfAbsent("Laundry|piece", k -> new ItemAgg("Laundry", "piece"));
                agg.quantitySold += itemCount;
                agg.revenue = agg.revenue.add(subtotal);
                agg.orderIds.add(laundryOrder.getId());
            }

            BigDecimal platformFee = payMethod == PaymentMethod.COD && laundryOrder.getPlatformFeeAmount() != null
                    ? laundryOrder.getPlatformFeeAmount()
                    : BigDecimal.ZERO;
            BigDecimal codFee = payMethod == PaymentMethod.COD && laundryOrder.getCodFee() != null
                    ? laundryOrder.getCodFee()
                    : BigDecimal.ZERO;
            rows.add(VendorSalesReportRow.builder()
                    .subOrderId(laundryOrder.getId())
                    .subOrderNumber(laundryOrder.getOrderNumber())
                    .orderId(laundryOrder.getId())
                    .orderNumber(laundryOrder.getOrderNumber())
                    .placedAt(laundryOrder.getPlacedAt())
                    .deliveredAt(laundryOrder.getDeliveredAt())
                    .status(delivered ? VendorSubOrderStatus.DELIVERED : VendorSubOrderStatus.READY_FOR_PICKUP)
                    .paymentMethod(payMethod)
                    .paymentStatus(payStatus)
                    .vendorAgentDelivery(payMethod == PaymentMethod.COD)
                    .subtotal(subtotal)
                    .itemCount(itemCount)
                    .platformFeeAmount(platformFee.setScale(2, RoundingMode.HALF_UP))
                    .codFeeAmount(codFee.setScale(2, RoundingMode.HALF_UP))
                    .membershipFeeAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                    .items(items)
                    .build());
        }

        Map<UUID, CodCashAllocation.OrderBreakdown> codSplitCache = new HashMap<>();
        Map<UUID, BigDecimal> shopRiderPayByTown = new HashMap<>();

        for (VendorSubOrder subOrder : subOrders) {
            statusCounts.merge(subOrder.getStatus().name(), 1L, Long::sum);

            PaymentStatus payStatus = subOrder.getOrder().getPaymentStatus();
            PaymentMethod payMethod = subOrder.getOrder().getPaymentMethod();
            if (payStatus != null) {
                paymentStatusCounts.merge(payStatus.name(), 1L, Long::sum);
            }
            if (payMethod != null) {
                paymentMethodCounts.merge(payMethod.name(), 1L, Long::sum);
            }

            BigDecimal subtotal = subOrder.getSubtotal() != null ? subOrder.getSubtotal() : BigDecimal.ZERO;
            boolean rejected = subOrder.getStatus() == VendorSubOrderStatus.VENDOR_REJECTED;
            boolean buyerCancelled = subOrder.getStatus() == VendorSubOrderStatus.BUYER_CANCELLED;
            BigDecimal rejectedDisplay = BigDecimal.ZERO;
            if (rejected) {
                // Prefer historical cancelled line totals (bag subtotal is often zeroed after reject).
                for (OrderItem item : subOrder.getItems()) {
                    rejectedDisplay = rejectedDisplay.add(
                            item.getLineTotal() != null ? item.getLineTotal() : BigDecimal.ZERO);
                }
                if (rejectedDisplay.compareTo(BigDecimal.ZERO) == 0) {
                    rejectedDisplay = subtotal;
                }
                rejectedAmount = rejectedAmount.add(rejectedDisplay);
            } else if (!buyerCancelled) {
                grossSales = grossSales.add(subtotal);
                if (payStatus == PaymentStatus.PAID) {
                    paidAmount = paidAmount.add(subtotal);
                } else if (payStatus == PaymentStatus.REFUNDED) {
                    refundedAmount = refundedAmount.add(subtotal);
                } else {
                    pendingAmount = pendingAmount.add(subtotal);
                }
            }

            int itemCount = 0;
            List<VendorSalesReportItem> items = null;
            if (includeItems) {
                items = new ArrayList<>();
            }
            for (OrderItem item : subOrder.getItems()) {
                boolean cancelled = item.getStatus() == OrderItemStatus.CANCELLED;
                if (!cancelled) {
                    itemCount += item.getQuantity();
                }
                if (includeItems) {
                    items.add(VendorSalesReportItem.builder()
                            .name(item.getItemNameSnapshot())
                            .unit(item.getUnitCodeSnapshot())
                            .quantity(item.getQuantity())
                            .unitPrice(item.getUnitPrice())
                            .discountPrice(item.getDiscountPrice())
                            .lineTotal(item.getLineTotal())
                            .build());
                }
                if (!rejected && !cancelled) {
                    String key = (item.getItemNameSnapshot() == null ? "Item" : item.getItemNameSnapshot().trim())
                            + "|"
                            + (item.getUnitCodeSnapshot() == null ? "" : item.getUnitCodeSnapshot());
                    ItemAgg agg = itemAggs.computeIfAbsent(key, k -> new ItemAgg(
                            item.getItemNameSnapshot() == null ? "Item" : item.getItemNameSnapshot().trim(),
                            item.getUnitCodeSnapshot()));
                    agg.quantitySold += item.getQuantity();
                    agg.revenue = agg.revenue.add(
                            item.getLineTotal() != null ? item.getLineTotal() : BigDecimal.ZERO);
                    agg.orderIds.add(subOrder.getId());
                }
            }
            itemQuantityTotal += itemCount;

            BigDecimal deliveryFeeAmount = BigDecimal.ZERO;
            BigDecimal platformFeeAmount = BigDecimal.ZERO;
            BigDecimal codFeeAmount = BigDecimal.ZERO;
            BigDecimal membershipFeeAmount = BigDecimal.ZERO;
            if (payMethod == PaymentMethod.COD && !rejected && !buyerCancelled) {
                deliveryFeeAmount = OrderBuyerFeeShare.deliveryFee(subOrder);
                platformFeeAmount = OrderBuyerFeeShare.platformFee(subOrder);
                codFeeAmount = OrderBuyerFeeShare.codFee(subOrder);
                membershipFeeAmount = OrderBuyerFeeShare.membershipFee(subOrder);
            }

            BigDecimal codCashCollected = null;
            if (payMethod == PaymentMethod.COD
                    && !rejected
                    && !buyerCancelled
                    && subOrder.getStatus() == VendorSubOrderStatus.DELIVERED) {
                codCashCollected = codCashForBag(subOrder, codSplitCache);
            }

            BigDecimal shopRiderPay = BigDecimal.ZERO;
            if (subOrder.getOrder().isVendorAgentDelivery()
                    && payMethod == PaymentMethod.COD
                    && !rejected
                    && !buyerCancelled
                    && subOrder.getStatus() == VendorSubOrderStatus.DELIVERED) {
                UUID townId = subOrder.getOrder().getTownId();
                if (townId != null) {
                    shopRiderPay = shopRiderPayByTown.computeIfAbsent(townId, id -> {
                        TownClient.VendorAgentDeliverySettings cfg = townClient.getVendorAgentDeliverySettings(id);
                        return cfg.enabled()
                                ? cfg.vendorAgentPayoutAmount()
                                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
                    });
                }
            }

            rows.add(VendorSalesReportRow.builder()
                    .subOrderId(subOrder.getId())
                    .subOrderNumber(subOrder.getSubOrderNumber())
                    .orderId(subOrder.getOrder().getId())
                    .orderNumber(subOrder.getOrder().getOrderNumber())
                    .placedAt(subOrder.getOrder().getPlacedAt())
                    .deliveredAt(subOrder.getOrder().getDeliveredAt())
                    .status(subOrder.getStatus())
                    .paymentMethod(payMethod)
                    .paymentStatus(payStatus)
                    .vendorAgentDelivery(subOrder.getOrder().isVendorAgentDelivery())
                    .subtotal(rejected ? rejectedDisplay : subtotal)
                    .itemCount(itemCount)
                    .deliveryFeeAmount(deliveryFeeAmount.setScale(2, RoundingMode.HALF_UP))
                    .shopRiderPayAmount(shopRiderPay.setScale(2, RoundingMode.HALF_UP))
                    .platformFeeAmount(platformFeeAmount.setScale(2, RoundingMode.HALF_UP))
                    .codFeeAmount(codFeeAmount.setScale(2, RoundingMode.HALF_UP))
                    .membershipFeeAmount(membershipFeeAmount.setScale(2, RoundingMode.HALF_UP))
                    .codCashCollectedAmount(
                            codCashCollected == null
                                    ? null
                                    : codCashCollected.setScale(2, RoundingMode.HALF_UP))
                    .items(items)
                    .build());
        }

        List<VendorSalesReportResponse.VendorItemPerformance> ranked = itemAggs.values().stream()
                .map(agg -> VendorSalesReportResponse.VendorItemPerformance.builder()
                        .name(agg.name)
                        .unit(agg.unit)
                        .quantitySold(agg.quantitySold)
                        .revenue(agg.revenue)
                        .orderCount(agg.orderIds.size())
                        .build())
                .sorted(Comparator
                        .comparingLong(VendorSalesReportResponse.VendorItemPerformance::getQuantitySold)
                        .reversed()
                        .thenComparing(VendorSalesReportResponse.VendorItemPerformance::getRevenue,
                                Comparator.reverseOrder()))
                .toList();

        List<VendorSalesReportResponse.VendorItemPerformance> top =
                ranked.stream().limit(ITEM_RANK_LIMIT).toList();
        List<VendorSalesReportResponse.VendorItemPerformance> least = ranked.stream()
                .sorted(Comparator
                        .comparingLong(VendorSalesReportResponse.VendorItemPerformance::getQuantitySold)
                        .thenComparing(VendorSalesReportResponse.VendorItemPerformance::getRevenue))
                .limit(ITEM_RANK_LIMIT)
                .toList();

        return VendorSalesReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .includeItems(includeItems)
                .orderCount(rows.size())
                .itemQuantityTotal(itemQuantityTotal)
                .grossSales(grossSales)
                .paidAmount(paidAmount)
                .pendingAmount(pendingAmount)
                .refundedAmount(refundedAmount)
                .rejectedAmount(rejectedAmount)
                .statusCounts(statusCounts)
                .paymentStatusCounts(paymentStatusCounts)
                .paymentMethodCounts(paymentMethodCounts)
                .rows(rows)
                .topSellingItems(top)
                .leastSellingItems(least)
                .build();
    }

    private static BigDecimal codCashForBag(
            VendorSubOrder subOrder, Map<UUID, CodCashAllocation.OrderBreakdown> cache) {
        var order = subOrder.getOrder();
        List<VendorSubOrder> bags =
                order.getVendorSubOrders() == null ? List.of(subOrder) : order.getVendorSubOrders();
        CodCashAllocation.OrderBreakdown split =
                cache.computeIfAbsent(order.getId(), id -> CodCashAllocation.split(order, bags));
        for (CodCashAllocation.VendorSlice slice : split.vendorSlices()) {
            if (slice.subOrderId().equals(subOrder.getId())) {
                return slice.allocatedCash();
            }
        }
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private static final class ItemAgg {
        private final String name;
        private final String unit;
        private long quantitySold;
        private BigDecimal revenue = BigDecimal.ZERO;
        private final java.util.HashSet<UUID> orderIds = new java.util.HashSet<>();

        private ItemAgg(String name, String unit) {
            this.name = name;
            this.unit = unit;
        }
    }

    private void validateDateRange(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' must be on or before 'to'");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
    }

    private Map<String, Long> zeroStatusCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (VendorSubOrderStatus status : VendorSubOrderStatus.values()) {
            counts.put(status.name(), 0L);
        }
        return counts;
    }

    private static PaymentStatus laundryPaymentStatus(LaundryPaymentStatus status) {
        if (status == LaundryPaymentStatus.COLLECTED) {
            return PaymentStatus.PAID;
        }
        if (status == LaundryPaymentStatus.REFUNDED || status == LaundryPaymentStatus.REFUND_DUE) {
            return PaymentStatus.REFUNDED;
        }
        return PaymentStatus.PENDING;
    }

    private static PaymentStatus beautyPaymentStatus(BeautyPaymentStatus status) {
        if (status == BeautyPaymentStatus.COLLECTED) {
            return PaymentStatus.PAID;
        }
        if (status == BeautyPaymentStatus.FAILED) {
            return PaymentStatus.FAILED;
        }
        return PaymentStatus.PENDING;
    }

    private void appendBeautySalesRows(
            BeautyOrder beautyOrder,
            PaymentStatus paymentStatusFilter,
            boolean includeItems,
            List<VendorSalesReportRow> rows,
            Map<String, ItemAgg> itemAggs,
            Map<String, Long> statusCounts,
            Map<String, Long> paymentStatusCounts,
            Map<String, Long> paymentMethodCounts,
            GlamSalesAccum accum) {
        PaymentStatus payStatus = beautyPaymentStatus(beautyOrder.getPaymentStatus());
        if (paymentStatusFilter != null && payStatus != paymentStatusFilter) {
            return;
        }
        BigDecimal onlinePaid = onlinePayments.sumSuccessfulPaymentsForOrder(beautyOrder.getId());
        if (onlinePaid == null) {
            onlinePaid = money(beautyOrder.getAmountCollected());
        }
        final BigDecimal gatewayOnline = onlinePaid;
        List<SettlementCandidateResponse.Item> settleItems =
                BeautySettlementItems.toItems(beautyOrder, id -> gatewayOnline);

        boolean delivered = beautyOrder.getStatus() == BeautyOrderStatus.COMPLETED;
        statusCounts.merge(
                delivered ? VendorSubOrderStatus.DELIVERED.name() : beautyOrder.getStatus().name(),
                1L,
                Long::sum);
        paymentStatusCounts.merge(payStatus.name(), 1L, Long::sum);

        BigDecimal goodsTotal = money(beautyOrder.getServiceAmount()).add(money(beautyOrder.getTravelCharge()));
        Instant deliveredAt = beautyOrder.getCompletedAt() != null ? beautyOrder.getCompletedAt()
                : beautyOrder.getSlotEnd() != null ? beautyOrder.getSlotEnd() : beautyOrder.getPlacedAt();
        BigDecimal bookingTotal = beautyOrder.getAmountDueTotal() != null && beautyOrder.getAmountDueTotal().signum() > 0
                ? money(beautyOrder.getAmountDueTotal())
                : goodsTotal;
        String prepayMode = beautyOrder.getPrepayMode();
        boolean hybrid = settleItems.size() > 1;

        if (delivered) {
            accum.grossSales = accum.grossSales.add(goodsTotal);
            if (payStatus == PaymentStatus.PAID) {
                accum.paidAmount = accum.paidAmount.add(goodsTotal);
            } else if (payStatus == PaymentStatus.REFUNDED) {
                accum.refundedAmount = accum.refundedAmount.add(goodsTotal);
            } else {
                accum.pendingAmount = accum.pendingAmount.add(goodsTotal);
            }
        }
        accum.itemQuantityTotal += 1;
        List<VendorSalesReportItem> lineItems = null;
        if (includeItems) {
            lineItems = List.of(VendorSalesReportItem.builder()
                    .name("Glam booking")
                    .unit("session")
                    .quantity(1)
                    .unitPrice(goodsTotal)
                    .discountPrice(null)
                    .lineTotal(goodsTotal)
                    .build());
        }
        if (delivered) {
            ItemAgg agg = itemAggs.computeIfAbsent("Glam booking|session", k -> new ItemAgg("Glam booking", "session"));
            agg.quantitySold += 1;
            agg.revenue = agg.revenue.add(goodsTotal);
            agg.orderIds.add(beautyOrder.getId());
        }

        for (SettlementCandidateResponse.Item item : settleItems) {
            boolean shopCash = item.isVendorAgentDelivery();
            PaymentMethod payMethod = item.getPaymentMethod();
            paymentMethodCounts.merge(payMethod.name(), 1L, Long::sum);

            BigDecimal platformFee = money(item.getPlatformFee());
            BigDecimal parlourFee = money(item.getParlourPaymentFee());
            BigDecimal codFee = money(item.getCodFee());
            BigDecimal visitCash = null;
            if (shopCash && hybrid) {
                visitCash = bookingTotal.subtract(gatewayOnline).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            }

            rows.add(VendorSalesReportRow.builder()
                    .subOrderId(item.getSubOrderId())
                    .subOrderNumber(item.getSubOrderNumber())
                    .orderId(beautyOrder.getId())
                    .orderNumber(beautyOrder.getOrderNumber())
                    .placedAt(beautyOrder.getPlacedAt())
                    .deliveredAt(deliveredAt)
                    .status(delivered ? VendorSubOrderStatus.DELIVERED : VendorSubOrderStatus.READY_FOR_PICKUP)
                    .paymentMethod(payMethod)
                    .paymentStatus(payStatus)
                    .vendorAgentDelivery(shopCash)
                    .subtotal(money(item.getSubtotal()))
                    .itemCount(1)
                    .platformFeeAmount(platformFee)
                    .parlourPaymentFeeAmount(parlourFee)
                    .codFeeAmount(codFee)
                    .membershipFeeAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                    .codCashCollectedAmount(visitCash)
                    .orderLineKind("GLAM")
                    .amountDueTotal(shopCash && hybrid ? bookingTotal : null)
                    .prepayAmount(shopCash && hybrid ? gatewayOnline : null)
                    .prepayMode(shopCash && hybrid ? prepayMode : null)
                    .onlineRemittanceAmount(item.getOnlineRemittanceAmount())
                    .items(lineItems)
                    .build());
        }
    }

    private static final class GlamSalesAccum {
        private BigDecimal grossSales = BigDecimal.ZERO;
        private BigDecimal paidAmount = BigDecimal.ZERO;
        private BigDecimal pendingAmount = BigDecimal.ZERO;
        private BigDecimal refundedAmount = BigDecimal.ZERO;
        private long itemQuantityTotal;
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
