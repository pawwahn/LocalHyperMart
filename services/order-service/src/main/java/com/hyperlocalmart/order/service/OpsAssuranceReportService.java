package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.dto.response.OpsAssuranceReportResponse;
import com.hyperlocalmart.order.dto.response.OpsAssuranceReportResponse.HsnGstRow;
import com.hyperlocalmart.order.dto.response.OpsAssuranceReportResponse.NamedAmount;
import com.hyperlocalmart.order.entity.ClaimStatus;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderClaim;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.repository.OrderClaimRepository;
import com.hyperlocalmart.order.repository.OrderItemRepository;
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
public class OpsAssuranceReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;
    private static final long LATE_AFTER_MINUTES = 90;
    private static final long OVERDUE_AFTER_HOURS = 24;

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderClaimRepository orderClaimRepository;
    private final TownClient townClient;

    @Transactional(readOnly = true)
    public OpsAssuranceReportResponse getReport(UUID townId, LocalDate from, LocalDate to) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo.minusDays(29);
        if (rangeFrom.isAfter(rangeTo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from must be on or before to");
        }
        if (ChronoUnit.DAYS.between(rangeFrom, rangeTo) + 1 > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }

        Instant start = rangeFrom.atStartOfDay(IST).toInstant();
        Instant end = rangeTo.plusDays(1).atStartOfDay(IST).toInstant();
        Instant now = Instant.now();

        List<HsnGstRow> hsnRows = new ArrayList<>();
        BigDecimal taxable = BigDecimal.ZERO;
        BigDecimal cgst = BigDecimal.ZERO;
        BigDecimal sgst = BigDecimal.ZERO;
        BigDecimal igst = BigDecimal.ZERO;
        BigDecimal cess = BigDecimal.ZERO;
        for (Object[] row : orderItemRepository.sumGstByHsnOnDelivered(townId, start, end)) {
            HsnGstRow mapped = HsnGstRow.builder()
                    .hsn(str(row[0]))
                    .gstPercent(money(bd(row[1])))
                    .lines(lng(row[2]))
                    .taxable(money(bd(row[3])))
                    .cgst(money(bd(row[4])))
                    .sgst(money(bd(row[5])))
                    .igst(money(bd(row[6])))
                    .cess(money(bd(row[7])))
                    .amount(money(bd(row[8])))
                    .build();
            hsnRows.add(mapped);
            taxable = taxable.add(mapped.getTaxable());
            cgst = cgst.add(mapped.getCgst());
            sgst = sgst.add(mapped.getSgst());
            igst = igst.add(mapped.getIgst());
            cess = cess.add(mapped.getCess());
        }

        List<OrderClaim> claims = orderClaimRepository.findInRange(townId, start, end);
        Map<String, Acc> byType = new LinkedHashMap<>();
        Map<UUID, Acc> byTown = new LinkedHashMap<>();
        long open = 0;
        long resolved = 0;
        long rejected = 0;
        BigDecimal credited = BigDecimal.ZERO;
        for (OrderClaim claim : claims) {
            if (claim.getStatus() == ClaimStatus.OPEN) {
                open++;
            } else if (claim.getStatus() == ClaimStatus.RESOLVED) {
                resolved++;
                credited = credited.add(nz(claim.getResolvedAmount()));
            } else if (claim.getStatus() == ClaimStatus.REJECTED) {
                rejected++;
            }
            String typeName = claim.getClaimType() != null ? claim.getClaimType().name() : "UNKNOWN";
            byType.computeIfAbsent(typeName, k -> new Acc()).add(1, nz(claim.getResolvedAmount()));
            byTown.computeIfAbsent(claim.getTownId(), k -> new Acc()).add(1, nz(claim.getResolvedAmount()));
        }

        List<Order> orders = orderRepository.findPlacedWithSubsInRange(townId, start, end);
        long placed = orders.size();
        long onTime = 0;
        long late = 0;
        long stillOpen = 0;
        long overdue = 0;
        long cancelled = 0;
        long deliverySamples = 0;
        long deliveryMinutes = 0;
        for (Order order : orders) {
            if (order.getStatus() == OrderStatus.CANCELLED) {
                cancelled++;
                continue;
            }
            if (order.getStatus() == OrderStatus.DELIVERED && order.getPlacedAt() != null && order.getDeliveredAt() != null) {
                long minutes = Duration.between(order.getPlacedAt(), order.getDeliveredAt()).toMinutes();
                deliverySamples++;
                deliveryMinutes += minutes;
                if (minutes > LATE_AFTER_MINUTES) {
                    late++;
                } else {
                    onTime++;
                }
                continue;
            }
            if (order.getStatus() == OrderStatus.PLACED) {
                stillOpen++;
                if (order.getPlacedAt() != null
                        && Duration.between(order.getPlacedAt(), now).toHours() >= OVERDUE_AFTER_HOURS) {
                    overdue++;
                }
            }
        }

        return OpsAssuranceReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .townId(townId)
                .gstByHsn(hsnRows)
                .gstTaxable(money(taxable))
                .gstCgst(money(cgst))
                .gstSgst(money(sgst))
                .gstIgst(money(igst))
                .gstCess(money(cess))
                .gstTotal(money(cgst.add(sgst).add(igst).add(cess)))
                .claimsOpened(claims.size())
                .claimsOpen(open)
                .claimsResolved(resolved)
                .claimsRejected(rejected)
                .claimsCredited(money(credited))
                .claimsByType(toNamed(byType))
                .claimsByTown(toTownNamed(byTown))
                .ordersPlaced(placed)
                .deliveredOnTime(onTime)
                .deliveredLate(late)
                .stillOpen(stillOpen)
                .openOverdue(overdue)
                .cancelled(cancelled)
                .lateDeliveryRate(rate(late, onTime + late))
                .avgDeliveryMinutes(deliverySamples == 0 ? null : round1(deliveryMinutes / (double) deliverySamples))
                .build();
    }

    private List<NamedAmount> toTownNamed(Map<UUID, Acc> byTown) {
        List<NamedAmount> rows = new ArrayList<>();
        byTown.forEach((id, acc) -> rows.add(NamedAmount.builder()
                .name(townName(id))
                .count(acc.count)
                .amount(money(acc.amount))
                .build()));
        rows.sort(Comparator.comparing(NamedAmount::getCount).reversed());
        return rows;
    }

    private static List<NamedAmount> toNamed(Map<String, Acc> map) {
        return map.entrySet().stream()
                .sorted(Comparator.comparing((Map.Entry<String, Acc> e) -> e.getValue().count).reversed())
                .map(e -> NamedAmount.builder()
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

    private static String str(Object v) {
        return v == null ? "UNMAPPED" : String.valueOf(v);
    }

    private static long lng(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.longValue();
        return Long.parseLong(String.valueOf(v));
    }

    private static BigDecimal bd(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal n) return n;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(String.valueOf(v));
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

    private static class Acc {
        long count;
        BigDecimal amount = BigDecimal.ZERO;

        void add(long n, BigDecimal money) {
            count += n;
            amount = amount.add(nz(money));
        }
    }
}
