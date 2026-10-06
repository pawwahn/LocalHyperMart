package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.PlatformFinanceAccrualResponse;
import com.hyperlocalmart.order.repository.OrderItemRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
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
public class PlatformFinanceAccrualService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    @Transactional(readOnly = true)
    public PlatformFinanceAccrualResponse accrual(UUID townId, LocalDate from, LocalDate to) {
        validateRange(from, to);
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();

        Object[] totals = normalizeAggregateRow(
                orderRepository.sumDeliveredCommercialsByTownAndDeliveredAtBetween(townId, start, end));
        long deliveredCount = asLong(totals[0]);
        BigDecimal platformFees = money(totals[1]);
        BigDecimal deliveryFees = money(totals[2]);
        BigDecimal codFees = money(totals[3]);
        BigDecimal orderTax = money(totals[4]);
        BigDecimal deliveredGmv = money(totals[5]);

        Object[] gst = normalizeAggregateRow(orderItemRepository.sumGstOnDeliveredOrders(townId, start, end));
        BigDecimal cgst = money(gst[0]);
        BigDecimal sgst = money(gst[1]);
        BigDecimal igst = money(gst[2]);
        BigDecimal gstTotal = cgst.add(sgst).add(igst);

        Map<LocalDate, long[]> dayCounts = new HashMap<>();
        Map<LocalDate, BigDecimal[]> dayFees = new HashMap<>();
        mergeDay(dayCounts, dayFees, orderRepository.countDeliveredGroupedByIstDayFiltered(townId, start, end), 0);
        mergeDayGmv(dayFees, orderRepository.sumDeliveredGmvGroupedByIstDayFiltered(townId, start, end), 1);
        mergeDayFees(dayFees, orderRepository.sumPlatformFeeGroupedByIstDayFiltered(townId, start, end), 0);
        mergeDayGst(dayFees, orderItemRepository.sumGstGroupedByDeliveredIstDay(townId, start, end), 2);

        List<PlatformFinanceAccrualResponse.DailyAccrualRow> daily = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            long[] c = dayCounts.getOrDefault(d, new long[1]);
            BigDecimal[] f = dayFees.getOrDefault(d, new BigDecimal[] {
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO
            });
            daily.add(PlatformFinanceAccrualResponse.DailyAccrualRow.builder()
                    .date(d)
                    .ordersDelivered(c[0])
                    .platformFees(f[0])
                    .deliveredGmv(f[1])
                    .gstTotal(f[2])
                    .build());
        }

        BigDecimal estimatedPlatformRevenue = platformFees.add(codFees);

        return PlatformFinanceAccrualResponse.builder()
                .from(from)
                .to(to)
                .townId(townId)
                .ordersDelivered(deliveredCount)
                .deliveredOrderValue(deliveredGmv)
                .platformFeesOnDelivered(platformFees)
                .deliveryFeesOnDelivered(deliveryFees)
                .codFeesOnDelivered(codFees)
                .orderLevelTaxAmount(orderTax)
                .itemCgst(cgst)
                .itemSgst(sgst)
                .itemIgst(igst)
                .itemGstTotal(gstTotal)
                .estimatedPlatformRevenueFromOrders(estimatedPlatformRevenue)
                .daily(daily)
                .build();
    }

    private static void mergeDay(Map<LocalDate, long[]> counts, Map<LocalDate, BigDecimal[]> fees, List<Object[]> rows, int idx) {
        for (Object[] row : rows) {
            LocalDate day = toLocalDate(row[0]);
            counts.computeIfAbsent(day, k -> new long[1])[idx] = ((Number) row[1]).longValue();
            fees.computeIfAbsent(day, k -> new BigDecimal[] {
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO
            });
        }
    }

    private static void mergeDayGmv(Map<LocalDate, BigDecimal[]> fees, List<Object[]> rows, int idx) {
        for (Object[] row : rows) {
            LocalDate day = toLocalDate(row[0]);
            fees.computeIfAbsent(day, k -> new BigDecimal[] {
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO
            })[idx] = money(row[1]);
        }
    }

    private static void mergeDayFees(Map<LocalDate, BigDecimal[]> fees, List<Object[]> rows, int idx) {
        for (Object[] row : rows) {
            LocalDate day = toLocalDate(row[0]);
            fees.computeIfAbsent(day, k -> new BigDecimal[] {
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO
            })[idx] = money(row[1]);
        }
    }

    private static void mergeDayGst(Map<LocalDate, BigDecimal[]> fees, List<Object[]> rows, int idx) {
        for (Object[] row : rows) {
            LocalDate day = toLocalDate(row[0]);
            BigDecimal gst = money(row[1]);
            fees.computeIfAbsent(day, k -> new BigDecimal[] {
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO
            })[idx] = gst;
        }
    }

    private static LocalDate toLocalDate(Object value) {
        if (value instanceof LocalDate ld) {
            return ld;
        }
        if (value instanceof Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        return LocalDate.parse(value.toString());
    }

    /** JPA/Hibernate may wrap multi-column aggregate as Object[] inside Object[]. */
    private static Object[] normalizeAggregateRow(Object result) {
        if (!(result instanceof Object[] row)) {
            return new Object[0];
        }
        if (row.length == 1 && row[0] instanceof Object[] nested) {
            return nested;
        }
        return row;
    }

    private static long asLong(Object value) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        return 0L;
    }

    private static BigDecimal money(Object value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (value instanceof BigDecimal b) {
            return b.setScale(2, RoundingMode.HALF_UP);
        }
        return new BigDecimal(value.toString()).setScale(2, RoundingMode.HALF_UP);
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' and 'to' are required");
        }
        if (from.isAfter(to)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' must be on or before 'to'");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
    }
}
