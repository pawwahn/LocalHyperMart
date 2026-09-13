package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.ScratchCardGiftReportResponse;
import com.hyperlocalmart.order.dto.response.ScratchCardGiftReportResponse.TownRow;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ScratchCardAdminService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Instant ALL_FROM = Instant.parse("1970-01-01T00:00:00Z");
    private static final Instant ALL_TO = Instant.parse("9999-01-01T00:00:00Z");
    private static final int MAX_RANGE_DAYS = 366;

    private final OrderScratchCardRepository scratchCardRepository;

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
                    .townName(null)
                    .issued(a.issued)
                    .scratched(a.scratched)
                    .unopened(a.unopened)
                    .giftedAmount(a.gifted)
                    .build());
        }
        towns.sort(Comparator.comparing(TownRow::getGiftedAmount).reversed()
                .thenComparing(r -> r.getTownName() == null ? "" : r.getTownName()));

        return ScratchCardGiftReportResponse.builder()
                .from(from)
                .to(to)
                .issued(issued)
                .scratched(scratched)
                .unopened(unopened)
                .giftedAmount(gifted)
                .towns(towns)
                .build();
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

    private static final class Acc {
        long issued;
        long scratched;
        long unopened;
        BigDecimal gifted = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
