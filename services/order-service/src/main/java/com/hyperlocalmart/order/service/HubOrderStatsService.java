package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.HubOrderStatsResponse;
import com.hyperlocalmart.order.dto.response.HubTownDailyReportStatsResponse;
import com.hyperlocalmart.order.dto.response.HubTownPaymentMixResponse;
import com.hyperlocalmart.order.dto.response.HubTownQualityReportResponse;
import com.hyperlocalmart.order.dto.response.HubTownReportStatsResponse;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HubOrderStatsService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 90;

    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public HubOrderStatsResponse getHubOrderStats(UUID townId) {
        return HubOrderStatsResponse.builder()
                .readyForPickupCount(vendorSubOrderRepository.countReadyForPickupByTownId(townId))
                .placedOrdersCount(orderRepository.countByTownIdAndStatus(townId, OrderStatus.PLACED))
                .build();
    }

    @Transactional(readOnly = true)
    public HubTownReportStatsResponse getTownReportStats(UUID townId, LocalDate from, LocalDate to) {
        validateDateRange(from, to);
        var start = from.atStartOfDay(IST).toInstant();
        var end = to.plusDays(1).atStartOfDay(IST).toInstant();
        return HubTownReportStatsResponse.builder()
                .from(from)
                .to(to)
                .ordersPlaced(orderRepository.countPlacedByTownIdAndPlacedAtBetween(townId, start, end))
                .ordersDelivered(orderRepository.countDeliveredByTownIdAndDeliveredAtBetween(townId, start, end))
                .ordersCancelled(orderRepository.countCancelledByTownIdAndCancelledAtBetween(townId, start, end))
                .subOrdersPlaced(vendorSubOrderRepository.countByTownIdAndPlacedAtBetween(townId, start, end))
                .bagsMarkedReady(vendorSubOrderRepository.countMarkedReadyByTownIdAndReadyAtBetween(townId, start, end))
                .placedGmv(orderRepository.sumPlacedGmvByTown(townId, start, end))
                .deliveredGmv(orderRepository.sumDeliveredGmvByTown(townId, start, end))
                .codGmv(orderRepository.sumCodDeliveredGmvByTown(townId, start, end))
                .build();
    }

    @Transactional(readOnly = true)
    public HubTownDailyReportStatsResponse getTownDailyReportStats(UUID townId, LocalDate from, LocalDate to) {
        validateDateRange(from, to);
        var start = from.atStartOfDay(IST).toInstant();
        var end = to.plusDays(1).atStartOfDay(IST).toInstant();

        Map<LocalDate, long[]> counts = new HashMap<>();
        Map<LocalDate, BigDecimal[]> gmv = new HashMap<>();

        mergeDayCounts(counts, orderRepository.countPlacedGroupedByIstDay(townId, start, end), 0);
        mergeDayCounts(counts, orderRepository.countDeliveredGroupedByIstDay(townId, start, end), 1);
        mergeDayCounts(counts, orderRepository.countCancelledGroupedByIstDay(townId, start, end), 2);
        mergeDayGmv(gmv, orderRepository.sumDeliveredGmvGroupedByIstDay(townId, start, end), 0);
        mergeDayGmv(gmv, orderRepository.sumCodDeliveredGmvGroupedByIstDay(townId, start, end), 1);

        List<HubTownDailyReportStatsResponse.DailyRow> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            long[] c = counts.getOrDefault(d, new long[3]);
            BigDecimal[] g = gmv.getOrDefault(d, new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
            days.add(HubTownDailyReportStatsResponse.DailyRow.builder()
                    .date(d)
                    .ordersPlaced(c[0])
                    .ordersDelivered(c[1])
                    .ordersCancelled(c[2])
                    .deliveredGmv(g[0])
                    .codDeliveredGmv(g[1])
                    .build());
        }

        return HubTownDailyReportStatsResponse.builder()
                .from(from)
                .to(to)
                .days(days)
                .build();
    }

    @Transactional(readOnly = true)
    public HubTownPaymentMixResponse getTownPaymentMix(UUID townId, LocalDate from, LocalDate to) {
        validateDateRange(from, to);
        var start = from.atStartOfDay(IST).toInstant();
        var end = to.plusDays(1).atStartOfDay(IST).toInstant();
        long delivered = orderRepository.countDeliveredByTownIdAndDeliveredAtBetween(townId, start, end);
        long codCount = orderRepository.countCodDeliveredByTownAndDeliveredAtBetween(townId, start, end);
        BigDecimal deliveredGmv = orderRepository.sumDeliveredGmvByTown(townId, start, end);
        BigDecimal codGmv = orderRepository.sumCodDeliveredGmvByTown(townId, start, end);
        if (deliveredGmv == null) {
            deliveredGmv = BigDecimal.ZERO;
        }
        if (codGmv == null) {
            codGmv = BigDecimal.ZERO;
        }
        BigDecimal onlineGmv = deliveredGmv.subtract(codGmv);
        long onlineCount = Math.max(0, delivered - codCount);
        return HubTownPaymentMixResponse.builder()
                .from(from)
                .to(to)
                .deliveredOrders(delivered)
                .codDeliveredOrders(codCount)
                .onlineDeliveredOrders(onlineCount)
                .deliveredGmv(deliveredGmv)
                .codDeliveredGmv(codGmv)
                .onlineDeliveredGmv(onlineGmv.max(BigDecimal.ZERO))
                .build();
    }

    @Transactional(readOnly = true)
    public HubTownQualityReportResponse getTownQualityReport(UUID townId, LocalDate from, LocalDate to) {
        validateDateRange(from, to);
        var start = from.atStartOfDay(IST).toInstant();
        var end = to.plusDays(1).atStartOfDay(IST).toInstant();
        long cancelled = orderRepository.countCancelledByTownIdAndCancelledAtBetween(townId, start, end);
        long bagsPlaced = vendorSubOrderRepository.countByTownIdAndPlacedAtBetween(townId, start, end);
        long bagsRejected = vendorSubOrderRepository.countRejectedByTownIdAndUpdatedAtBetween(townId, start, end);
        double rejectRate = bagsPlaced > 0 ? (100.0 * bagsRejected / bagsPlaced) : 0.0;

        List<HubTownQualityReportResponse.ReasonCount> reasons = new ArrayList<>();
        for (Object[] row : orderRepository.countCancelReasonsGroupedByTown(townId, start, end)) {
            reasons.add(HubTownQualityReportResponse.ReasonCount.builder()
                    .reason(String.valueOf(row[0]))
                    .count(((Number) row[1]).longValue())
                    .build());
        }

        return HubTownQualityReportResponse.builder()
                .from(from)
                .to(to)
                .ordersCancelled(cancelled)
                .shopBagsPlaced(bagsPlaced)
                .shopBagsRejected(bagsRejected)
                .rejectRatePercent(Math.round(rejectRate * 10.0) / 10.0)
                .cancelReasons(reasons)
                .build();
    }

    private static void mergeDayCounts(Map<LocalDate, long[]> target, List<Object[]> rows, int index) {
        for (Object[] row : rows) {
            LocalDate day = toLocalDate(row[0]);
            long count = ((Number) row[1]).longValue();
            target.computeIfAbsent(day, k -> new long[3])[index] = count;
        }
    }

    private static void mergeDayGmv(Map<LocalDate, BigDecimal[]> target, List<Object[]> rows, int index) {
        for (Object[] row : rows) {
            LocalDate day = toLocalDate(row[0]);
            BigDecimal amount = row[1] instanceof BigDecimal b ? b : new BigDecimal(row[1].toString());
            target.computeIfAbsent(day, k -> new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO})[index] = amount;
        }
    }

    private static LocalDate toLocalDate(Object value) {
        if (value == null) {
            throw new IllegalArgumentException("Null date in hub daily report row");
        }
        if (value instanceof LocalDate ld) {
            return ld;
        }
        if (value instanceof Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        if (value instanceof java.util.Date utilDate) {
            return Instant.ofEpochMilli(utilDate.getTime()).atZone(IST).toLocalDate();
        }
        if (value instanceof Timestamp ts) {
            return ts.toInstant().atZone(IST).toLocalDate();
        }
        if (value instanceof Instant inst) {
            return inst.atZone(IST).toLocalDate();
        }
        return LocalDate.parse(value.toString());
    }

    private void validateDateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' and 'to' are required");
        }
        if (from.isAfter(to)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' must be on or before 'to'");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
    }
}
