package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.BuyerSpendReportResponse;
import com.hyperlocalmart.order.dto.response.BuyerSpendReportResponse.MonthRow;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BuyerSpendReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public BuyerSpendReportResponse getReport(UUID buyerId, UUID townId, LocalDate from, LocalDate to) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo.minusMonths(5).withDayOfMonth(1);
        if (rangeFrom.isAfter(rangeTo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from must be on or before to");
        }
        long days = ChronoUnit.DAYS.between(rangeFrom, rangeTo) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }

        Instant start = rangeFrom.atStartOfDay(IST).toInstant();
        Instant end = rangeTo.plusDays(1).atStartOfDay(IST).toInstant();
        List<Order> orders = orderRepository.findBuyerPlacedWithSubsInRange(buyerId, townId, start, end);

        long delivered = 0;
        long cancelled = 0;
        BigDecimal spent = BigDecimal.ZERO;
        BigDecimal deliveredSpend = BigDecimal.ZERO;
        BigDecimal codSpend = BigDecimal.ZERO;
        BigDecimal onlineSpend = BigDecimal.ZERO;
        Map<YearMonth, MonthAcc> months = new LinkedHashMap<>();

        for (Order order : orders) {
            BigDecimal total = order.getTotalAmount() == null ? BigDecimal.ZERO : order.getTotalAmount();
            spent = spent.add(total);
            YearMonth ym = YearMonth.from(LocalDate.ofInstant(order.getPlacedAt(), IST));
            MonthAcc acc = months.computeIfAbsent(ym, k -> new MonthAcc());
            acc.orders++;
            acc.spent = acc.spent.add(total);
            if (order.getStatus() == OrderStatus.DELIVERED) {
                delivered++;
                deliveredSpend = deliveredSpend.add(total);
                if (order.getPaymentMethod() == PaymentMethod.COD) {
                    codSpend = codSpend.add(total);
                } else if (order.getPaymentMethod() == PaymentMethod.ONLINE) {
                    onlineSpend = onlineSpend.add(total);
                }
            }
            if (order.getStatus() == OrderStatus.CANCELLED) {
                cancelled++;
            }
        }

        long placed = orders.size();
        List<MonthRow> monthRows = new ArrayList<>();
        months.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> monthRows.add(MonthRow.builder()
                        .month(e.getKey().format(MONTH))
                        .orders(e.getValue().orders)
                        .spent(e.getValue().spent.setScale(2, RoundingMode.HALF_UP))
                        .build()));

        return BuyerSpendReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .townId(townId)
                .ordersPlaced(placed)
                .ordersDelivered(delivered)
                .ordersCancelled(cancelled)
                .spent(spent.setScale(2, RoundingMode.HALF_UP))
                .deliveredSpend(deliveredSpend.setScale(2, RoundingMode.HALF_UP))
                .codSpend(codSpend.setScale(2, RoundingMode.HALF_UP))
                .onlineSpend(onlineSpend.setScale(2, RoundingMode.HALF_UP))
                .averageOrderValue(placed == 0
                        ? BigDecimal.ZERO.setScale(2)
                        : spent.divide(BigDecimal.valueOf(placed), 2, RoundingMode.HALF_UP))
                .months(monthRows)
                .build();
    }

    private static class MonthAcc {
        long orders;
        BigDecimal spent = BigDecimal.ZERO;
    }
}
