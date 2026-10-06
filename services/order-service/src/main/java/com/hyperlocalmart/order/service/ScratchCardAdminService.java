package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.dto.response.ScratchCardGiftReportResponse;
import com.hyperlocalmart.order.dto.response.ScratchCardGiftReportResponse.Line;
import com.hyperlocalmart.order.dto.response.ScratchCardGiftReportResponse.TownRow;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderScratchCard;
import com.hyperlocalmart.order.entity.ScratchCardStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderScratchCardRepository;
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
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScratchCardAdminService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Instant ALL_FROM = Instant.parse("1970-01-01T00:00:00Z");
    private static final Instant ALL_TO = Instant.parse("9999-01-01T00:00:00Z");
    private static final int MAX_RANGE_DAYS = 366;
    private static final int MAX_LINES = 1500;

    private final OrderScratchCardRepository scratchCardRepository;
    private final OrderRepository orderRepository;
    private final TownClient townClient;

    @Transactional(readOnly = true)
    public ScratchCardGiftReportResponse townGiftReport(UUID townId, LocalDate from, LocalDate to) {
        Instant fromTs = ALL_FROM;
        Instant toTs = ALL_TO;
        if (from != null || to != null) {
            if (from == null || to == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from and to are required together");
            }
            if (from.isAfter(to)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from must be on or before to");
            }
            long days = ChronoUnit.DAYS.between(from, to) + 1;
            if (days > MAX_RANGE_DAYS) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
            }
            fromTs = from.atStartOfDay(IST).toInstant();
            toTs = to.plusDays(1).atStartOfDay(IST).toInstant();
        }

        Map<UUID, Acc> byTown = new LinkedHashMap<>();
        List<Object[]> issuedRows = townId == null
                ? scratchCardRepository.countIssuedBetween(fromTs, toTs)
                : scratchCardRepository.countIssuedBetweenForTown(townId, fromTs, toTs);
        for (Object[] row : issuedRows) {
            acc(byTown, (UUID) row[0]).issued = toLong(row[1]);
        }
        List<Object[]> giftedRows = townId == null
                ? scratchCardRepository.sumGiftedBetween(fromTs, toTs)
                : scratchCardRepository.sumGiftedBetweenForTown(townId, fromTs, toTs);
        BigDecimal minGift = null;
        BigDecimal maxGift = null;
        for (Object[] row : giftedRows) {
            Acc a = acc(byTown, (UUID) row[0]);
            a.scratched = toLong(row[1]);
            a.gifted = toMoney(row[2]);
        }
        List<Object[]> unopenedRows = townId == null
                ? scratchCardRepository.countUnopenedByTown()
                : scratchCardRepository.countUnopenedForTown(townId);
        for (Object[] row : unopenedRows) {
            acc(byTown, (UUID) row[0]).unopened = toLong(row[1]);
        }

        List<OrderScratchCard> activity = scratchCardRepository.findActivityBetween(townId, fromTs, toTs);
        Map<UUID, String> townNames = new HashMap<>();
        for (UUID id : byTown.keySet()) {
            townNames.put(id, townName(id));
        }
        for (OrderScratchCard card : activity) {
            townNames.computeIfAbsent(card.getTownId(), this::townName);
            if (card.getStatus() == ScratchCardStatus.REVEALED && card.getRevealedAmount() != null) {
                BigDecimal amt = toMoney(card.getRevealedAmount());
                minGift = minGift == null || amt.compareTo(minGift) < 0 ? amt : minGift;
                maxGift = maxGift == null || amt.compareTo(maxGift) > 0 ? amt : maxGift;
            }
        }

        Set<UUID> orderIds = activity.stream().map(OrderScratchCard::getOrderId).collect(Collectors.toSet());
        Map<UUID, Order> orders = new HashMap<>();
        if (!orderIds.isEmpty()) {
            for (Order order : orderRepository.findAllById(orderIds)) {
                orders.put(order.getId(), order);
            }
        }

        List<Line> lines = new ArrayList<>();
        int take = Math.min(activity.size(), MAX_LINES);
        for (int i = 0; i < take; i++) {
            OrderScratchCard card = activity.get(i);
            Order order = orders.get(card.getOrderId());
            boolean revealed = card.getStatus() == ScratchCardStatus.REVEALED;
            BigDecimal spent = revealed ? toMoney(card.getRevealedAmount()) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            lines.add(Line.builder()
                    .cardId(card.getId())
                    .issuedAt(istDate(card.getCreatedAt()))
                    .revealedAt(istDate(card.getRevealedAt()))
                    .status(card.getStatus() == null ? "" : card.getStatus().name())
                    .townId(card.getTownId())
                    .townName(townNames.getOrDefault(card.getTownId(), ""))
                    .orderId(card.getOrderId())
                    .orderNumber(order == null ? "" : order.getOrderNumber())
                    .buyerPhone(order == null || order.getBuyerPhoneSnapshot() == null ? "" : order.getBuyerPhoneSnapshot())
                    .revealedAmount(toMoney(card.getRevealedAmount()))
                    .rewardMin(toMoney(card.getRewardMin()))
                    .rewardMax(toMoney(card.getRewardMax()))
                    .companySpent(spent)
                    .build());
        }

        List<TownRow> towns = new ArrayList<>();
        long issued = 0;
        long scratched = 0;
        long unopened = 0;
        BigDecimal gifted = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        for (Map.Entry<UUID, Acc> e : byTown.entrySet()) {
            Acc a = e.getValue();
            issued += a.issued;
            scratched += a.scratched;
            unopened += a.unopened;
            gifted = gifted.add(a.gifted);
            towns.add(TownRow.builder()
                    .townId(e.getKey())
                    .townName(townNames.get(e.getKey()))
                    .issued(a.issued)
                    .scratched(a.scratched)
                    .unopened(a.unopened)
                    .giftedAmount(a.gifted)
                    .build());
        }
        towns.sort(Comparator.comparing(TownRow::getGiftedAmount).reversed()
                .thenComparing(r -> r.getTownName() == null ? "" : r.getTownName()));

        BigDecimal avg = scratched > 0
                ? gifted.divide(BigDecimal.valueOf(scratched), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        return ScratchCardGiftReportResponse.builder()
                .from(from)
                .to(to)
                .issued(issued)
                .scratched(scratched)
                .unopened(unopened)
                .giftedAmount(gifted)
                .avgGift(avg)
                .minGift(minGift == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : minGift)
                .maxGift(maxGift == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : maxGift)
                .pendingMin(toMoney(scratchCardRepository.sumUnopenedMin(townId)))
                .pendingMax(toMoney(scratchCardRepository.sumUnopenedMax(townId)))
                .towns(towns)
                .lines(lines)
                .build();
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
        return townId == null ? "" : townId.toString().substring(0, 8);
    }

    private static Acc acc(Map<UUID, Acc> byTown, UUID townId) {
        return byTown.computeIfAbsent(townId, id -> new Acc());
    }

    private static long toLong(Object raw) {
        if (raw instanceof Number n) {
            return n.longValue();
        }
        return 0L;
    }

    private static BigDecimal toMoney(Object raw) {
        if (raw instanceof BigDecimal bd) {
            return bd.setScale(2, RoundingMode.HALF_UP);
        }
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private static String istDate(Instant instant) {
        if (instant == null) {
            return "";
        }
        return instant.atZone(IST).toLocalDate().toString();
    }

    private static final class Acc {
        long issued;
        long scratched;
        long unopened;
        BigDecimal gifted = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
