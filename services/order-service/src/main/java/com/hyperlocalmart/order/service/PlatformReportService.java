package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.dto.response.PlatformReportResponse;
import com.hyperlocalmart.order.dto.response.PlatformReportResponse.DailyRow;
import com.hyperlocalmart.order.dto.response.PlatformReportResponse.NamedCount;
import com.hyperlocalmart.order.dto.response.PlatformReportResponse.TownRow;
import com.hyperlocalmart.order.dto.response.PlatformReportResponse.VendorRow;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlatformReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;

    private final OrderRepository orderRepository;
    private final TownClient townClient;

    @Transactional(readOnly = true)
    public PlatformReportResponse getReport(UUID townId, LocalDate from, LocalDate to) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo.minusDays(29);
        if (rangeFrom.isAfter(rangeTo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from must be on or before to");
        }
        long days = ChronoUnit.DAYS.between(rangeFrom, rangeTo) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }

        Instant start = rangeFrom.atStartOfDay(IST).toInstant();
        Instant end = rangeTo.plusDays(1).atStartOfDay(IST).toInstant();
        List<Order> orders = orderRepository.findPlacedWithSubsInRange(townId, start, end);

        Map<String, Long> statusMix = new LinkedHashMap<>();
        Map<String, NamedAcc> paymentMix = new LinkedHashMap<>();
        Map<LocalDate, DayAcc> daily = new LinkedHashMap<>();
        Map<UUID, TownAcc> towns = new LinkedHashMap<>();
        Map<UUID, VendorAcc> vendors = new LinkedHashMap<>();
        Map<String, Long> cancelReasons = new LinkedHashMap<>();

        for (LocalDate d = rangeFrom; !d.isAfter(rangeTo); d = d.plusDays(1)) {
            daily.put(d, new DayAcc());
        }

        long delivered = 0;
        long cancelled = 0;
        long bagsRejected = 0;
        long bagsTotal = 0;
        BigDecimal placedGmv = BigDecimal.ZERO;
        BigDecimal deliveredGmv = BigDecimal.ZERO;
        BigDecimal cancelledGmv = BigDecimal.ZERO;
        BigDecimal codGmv = BigDecimal.ZERO;
        BigDecimal onlineGmv = BigDecimal.ZERO;
        BigDecimal platformFees = BigDecimal.ZERO;
        BigDecimal deliveryFeesCollected = BigDecimal.ZERO;
        BigDecimal promoDiscounts = BigDecimal.ZERO;
        long membershipDeliveriesWaived = 0;
        BigDecimal membershipFeeWaived = BigDecimal.ZERO;
        long readySamples = 0;
        long readyMinutes = 0;
        long deliverySamples = 0;
        long deliveryMinutes = 0;
        var buyers = new java.util.HashSet<UUID>();

        for (Order order : orders) {
            buyers.add(order.getBuyerId());
            BigDecimal total = nz(order.getTotalAmount());
            placedGmv = placedGmv.add(total);
            platformFees = platformFees.add(nz(order.getPlatformFee()));
            promoDiscounts = promoDiscounts.add(nz(order.getPromoDiscount()));
            statusMix.merge(order.getStatus().name(), 1L, Long::sum);

            String payKey = order.getPaymentMethod() != null ? order.getPaymentMethod().name() : "UNKNOWN";
            paymentMix.computeIfAbsent(payKey, k -> new NamedAcc()).add(1, total);

            LocalDate day = LocalDate.ofInstant(order.getPlacedAt(), IST);
            DayAcc dayAcc = daily.computeIfAbsent(day, d -> new DayAcc());
            dayAcc.orders++;
            dayAcc.gmv = dayAcc.gmv.add(total);

            TownAcc townAcc = towns.computeIfAbsent(order.getTownId(), id -> new TownAcc());
            townAcc.orders++;
            townAcc.placedGmv = townAcc.placedGmv.add(total);

            if (order.isMembershipCreditUsed()) {
                membershipDeliveriesWaived++;
                membershipFeeWaived = membershipFeeWaived.add(nz(order.getMembershipDeliveryWaived()));
            }
            if (order.getStatus() == OrderStatus.DELIVERED) {
                delivered++;
                deliveredGmv = deliveredGmv.add(total);
                deliveryFeesCollected = deliveryFeesCollected.add(nz(order.getDeliveryFee()));
                dayAcc.delivered++;
                townAcc.delivered++;
                townAcc.deliveredGmv = townAcc.deliveredGmv.add(total);
                if (order.getPaymentMethod() == PaymentMethod.COD) {
                    codGmv = codGmv.add(total);
                    townAcc.codGmv = townAcc.codGmv.add(total);
                } else if (order.getPaymentMethod() == PaymentMethod.ONLINE) {
                    onlineGmv = onlineGmv.add(total);
                }
                if (order.getDeliveredAt() != null && order.getPlacedAt() != null) {
                    deliverySamples++;
                    deliveryMinutes += Math.max(0, Duration.between(order.getPlacedAt(), order.getDeliveredAt()).toMinutes());
                }
            }
            if (order.getStatus() == OrderStatus.CANCELLED) {
                cancelled++;
                cancelledGmv = cancelledGmv.add(total);
                dayAcc.cancelled++;
                townAcc.cancelled++;
                String reason = order.getCancelReason() == null || order.getCancelReason().isBlank()
                        ? "Unspecified"
                        : order.getCancelReason().trim();
                cancelReasons.merge(reason, 1L, Long::sum);
            }

            for (VendorSubOrder bag : order.getVendorSubOrders()) {
                bagsTotal++;
                VendorAcc vendor = vendors.computeIfAbsent(bag.getVendorId(), id -> new VendorAcc());
                vendor.bags++;
                if (bag.getStatus() == VendorSubOrderStatus.VENDOR_REJECTED) {
                    bagsRejected++;
                    vendor.rejected++;
                } else {
                    vendor.sales = vendor.sales.add(nz(bag.getSubtotal()));
                }
                if (bag.getStatus() == VendorSubOrderStatus.READY_FOR_PICKUP
                        || bag.getReadyForPickupAt() != null) {
                    vendor.ready++;
                }
                if (bag.getReadyForPickupAt() != null && order.getPlacedAt() != null) {
                    readySamples++;
                    readyMinutes += Math.max(0, Duration.between(order.getPlacedAt(), bag.getReadyForPickupAt()).toMinutes());
                }
                if (vendor.shopName == null) {
                    vendor.shopName = shopName(bag);
                }
            }
        }

        long placed = orders.size();
        return PlatformReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .townId(townId)
                .ordersPlaced(placed)
                .ordersDelivered(delivered)
                .ordersCancelled(cancelled)
                .bagsRejected(bagsRejected)
                .uniqueBuyers(buyers.size())
                .placedGmv(money(placedGmv))
                .deliveredGmv(money(deliveredGmv))
                .cancelledGmv(money(cancelledGmv))
                .codGmv(money(codGmv))
                .onlineGmv(money(onlineGmv))
                .platformFees(money(platformFees))
                .deliveryFeesCollected(money(deliveryFeesCollected))
                .promoDiscounts(money(promoDiscounts))
                .averageOrderValue(placed == 0 ? money(BigDecimal.ZERO) : money(placedGmv.divide(BigDecimal.valueOf(placed), 2, RoundingMode.HALF_UP)))
                .deliveryRate(rate(delivered, placed))
                .cancelRate(rate(cancelled, placed))
                .rejectRate(rate(bagsRejected, bagsTotal))
                .avgReadyMinutes(readySamples == 0 ? null : round1(readyMinutes / (double) readySamples))
                .avgDeliveryMinutes(deliverySamples == 0 ? null : round1(deliveryMinutes / (double) deliverySamples))
                .membershipDeliveriesWaived(membershipDeliveriesWaived)
                .membershipFeeWaived(money(membershipFeeWaived))
                .statusMix(toNamed(statusMix))
                .paymentMix(toNamedAcc(paymentMix))
                .daily(toDaily(daily))
                .towns(toTowns(towns))
                .vendors(toVendors(vendors))
                .cancelReasons(toNamed(cancelReasons))
                .build();
    }

    private List<TownRow> toTowns(Map<UUID, TownAcc> towns) {
        List<TownRow> rows = new ArrayList<>();
        for (var e : towns.entrySet()) {
            TownAcc a = e.getValue();
            rows.add(TownRow.builder()
                    .townId(e.getKey())
                    .townName(townName(e.getKey()))
                    .orders(a.orders)
                    .delivered(a.delivered)
                    .cancelled(a.cancelled)
                    .placedGmv(money(a.placedGmv))
                    .deliveredGmv(money(a.deliveredGmv))
                    .codGmv(money(a.codGmv))
                    .build());
        }
        rows.sort(Comparator.comparing(TownRow::getPlacedGmv).reversed());
        return rows;
    }

    private List<VendorRow> toVendors(Map<UUID, VendorAcc> vendors) {
        List<VendorRow> rows = new ArrayList<>();
        for (var e : vendors.entrySet()) {
            VendorAcc a = e.getValue();
            rows.add(VendorRow.builder()
                    .vendorId(e.getKey())
                    .shopName(a.shopName != null ? a.shopName : "Shop")
                    .bags(a.bags)
                    .ready(a.ready)
                    .rejected(a.rejected)
                    .sales(money(a.sales))
                    .build());
        }
        rows.sort(Comparator.comparing(VendorRow::getSales).reversed());
        return rows.size() > 25 ? rows.subList(0, 25) : rows;
    }

    private static List<DailyRow> toDaily(Map<LocalDate, DayAcc> daily) {
        List<DailyRow> rows = new ArrayList<>();
        daily.forEach((date, a) -> rows.add(DailyRow.builder()
                .date(date)
                .orders(a.orders)
                .delivered(a.delivered)
                .cancelled(a.cancelled)
                .gmv(money(a.gmv))
                .build()));
        rows.sort(Comparator.comparing(DailyRow::getDate));
        return rows;
    }

    private static List<NamedCount> toNamed(Map<String, Long> map) {
        return map.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> NamedCount.builder().name(e.getKey()).count(e.getValue()).amount(money(BigDecimal.ZERO)).build())
                .toList();
    }

    private static List<NamedCount> toNamedAcc(Map<String, NamedAcc> map) {
        return map.entrySet().stream()
                .sorted(Comparator.comparing((Map.Entry<String, NamedAcc> e) -> e.getValue().amount).reversed())
                .map(e -> NamedCount.builder()
                        .name(e.getKey())
                        .count(e.getValue().count)
                        .amount(money(e.getValue().amount))
                        .build())
                .toList();
    }

    private String townName(UUID townId) {
        try {
            TownClient.TownSummary summary = townClient.getTownSummary(townId);
            if (summary != null && summary.displayName() != null && !summary.displayName().isBlank()) {
                return summary.displayName();
            }
        } catch (Exception ignored) {
            // display only
        }
        return townId.toString().substring(0, 8);
    }

    private static String shopName(VendorSubOrder bag) {
        if (bag.getItems() == null || bag.getItems().isEmpty()) return null;
        String name = bag.getItems().getFirst().getShopNameSnapshot();
        return name == null || name.isBlank() ? null : name;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal money(BigDecimal v) {
        return nz(v).setScale(2, RoundingMode.HALF_UP);
    }

    private static double rate(long num, long den) {
        if (den <= 0) return 0;
        return Math.round(num * 1000.0 / den) / 10.0;
    }

    private static Double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static class DayAcc {
        long orders;
        long delivered;
        long cancelled;
        BigDecimal gmv = BigDecimal.ZERO;
    }

    private static class TownAcc {
        long orders;
        long delivered;
        long cancelled;
        BigDecimal placedGmv = BigDecimal.ZERO;
        BigDecimal deliveredGmv = BigDecimal.ZERO;
        BigDecimal codGmv = BigDecimal.ZERO;
    }

    private static class VendorAcc {
        String shopName;
        long bags;
        long ready;
        long rejected;
        BigDecimal sales = BigDecimal.ZERO;
    }

    private static class NamedAcc {
        long count;
        BigDecimal amount = BigDecimal.ZERO;

        void add(long n, BigDecimal money) {
            count += n;
            amount = amount.add(nz(money));
        }
    }
}
