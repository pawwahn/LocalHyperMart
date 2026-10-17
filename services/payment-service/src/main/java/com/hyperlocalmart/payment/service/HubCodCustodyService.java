package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.entity.CodCloseDay;
import com.hyperlocalmart.payment.entity.CodCloseDayLineItem;
import com.hyperlocalmart.payment.entity.CodCustodianType;
import com.hyperlocalmart.payment.entity.HubPaymentRequestStatus;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import com.hyperlocalmart.payment.repository.CodCloseDayRepository;
import com.hyperlocalmart.payment.repository.CodHubPlatformRemittanceRepository;
import com.hyperlocalmart.payment.repository.HubPaymentRequestCodLineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Hub close-day cash is a pool. Remittances pay the oldest cash first.
 * What is left is still at the hub. The rest is already with KoyaKart.
 */
@Service
@RequiredArgsConstructor
public class HubCodCustodyService {

    private static final LocalDate EARLIEST = LocalDate.of(2020, 1, 1);
    private static final LocalDate LATEST = LocalDate.of(2999, 12, 31);
    private static final List<HubPaymentRequestStatus> BLOCKING = List.of(
            HubPaymentRequestStatus.ISSUED,
            HubPaymentRequestStatus.PAYMENT_PENDING,
            HubPaymentRequestStatus.APPROVED);

    private final CodCloseDayLineItemRepository closeLineRepository;
    private final CodCloseDayRepository closeDayRepository;
    private final CodHubPlatformRemittanceRepository remittanceRepository;
    private final HubPaymentRequestCodLineRepository billLineRepository;

    public record DueLine(UUID orderId, String orderNumber, LocalDate closeDate, BigDecimal amount) {}

    public record Due(List<DueLine> lines, BigDecimal total, BigDecimal balanceOwed) {}

    @Transactional(readOnly = true)
    public Due dueInRange(UUID townId, UUID hubId, LocalDate from, LocalDate to) {
        BigDecimal balance = balanceOwed(townId, hubId);
        List<DueLine> open = stillAtHub(unbilled(townId, hubId, EARLIEST, LATEST), balance);
        List<DueLine> inRange = open.stream()
                .filter(line -> line.closeDate() != null
                        && !line.closeDate().isBefore(from)
                        && !line.closeDate().isAfter(to)
                        && line.amount().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        BigDecimal total = inRange.stream()
                .map(DueLine::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        return new Due(inRange, total, balance);
    }

    /** Orders whose hub close-day cash is already with KoyaKart (remitted, or nothing was collected). */
    @Transactional(readOnly = true)
    public Set<UUID> ordersAlreadyWithCompany(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return Set.of();
        }
        List<CodCloseDayLineItem> touched = closeLineRepository.findHubLinesForOrders(orderIds);
        if (touched.isEmpty()) {
            return Set.of();
        }
        Map<UUID, List<CodCloseDayLineItem>> byHub = new HashMap<>();
        Set<UUID> closed = new HashSet<>();
        for (CodCloseDayLineItem line : touched) {
            if (line.getOrderId() == null || line.getCloseDay() == null || line.getCloseDay().getHubId() == null) {
                continue;
            }
            closed.add(line.getOrderId());
            byHub.computeIfAbsent(line.getCloseDay().getHubId(), ignored -> new ArrayList<>()).add(line);
        }
        Set<UUID> stillHere = new HashSet<>();
        for (Map.Entry<UUID, List<CodCloseDayLineItem>> entry : byHub.entrySet()) {
            CodCloseDay sample = entry.getValue().get(0).getCloseDay();
            List<DueLine> open = stillAtHub(
                    unbilled(sample.getTownId(), entry.getKey(), EARLIEST, LATEST),
                    balanceOwed(sample.getTownId(), entry.getKey()));
            for (DueLine line : open) {
                if (line.amount().compareTo(BigDecimal.ZERO) > 0) {
                    stillHere.add(line.orderId());
                }
            }
        }
        closed.removeAll(stillHere);
        return closed;
    }

    private BigDecimal balanceOwed(UUID townId, UUID hubId) {
        BigDecimal received = scale(closeDayRepository.sumReceivedByTownHubAndCustodian(
                townId, hubId, CodCustodianType.HUB));
        BigDecimal remitted = scale(remittanceRepository.sumAmountByTownAndHub(townId, hubId));
        BigDecimal balance = received.subtract(remitted).setScale(2, RoundingMode.HALF_UP);
        return balance.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : balance;
    }

    private List<DueLine> unbilled(UUID townId, UUID hubId, LocalDate from, LocalDate to) {
        List<CodCloseDayLineItem> rows = closeLineRepository.findHubCloseLinesInRange(
                townId, hubId, CodCustodianType.HUB, from, to);
        Map<UUID, DueLine> byOrder = new HashMap<>();
        for (CodCloseDayLineItem item : rows) {
            if (item.getOrderId() == null) {
                continue;
            }
            CodCloseDay close = item.getCloseDay();
            LocalDate closeDate = close == null ? null : close.getCloseDate();
            DueLine existing = byOrder.get(item.getOrderId());
            BigDecimal amount = scale(item.getAmount());
            if (existing == null) {
                byOrder.put(item.getOrderId(), new DueLine(
                        item.getOrderId(), item.getOrderNumber(), closeDate, amount));
            } else {
                LocalDate earlier = earlier(existing.closeDate(), closeDate);
                byOrder.put(item.getOrderId(), new DueLine(
                        item.getOrderId(),
                        existing.orderNumber() != null ? existing.orderNumber() : item.getOrderNumber(),
                        earlier,
                        existing.amount().add(amount).setScale(2, RoundingMode.HALF_UP)));
            }
        }
        if (byOrder.isEmpty()) {
            return List.of();
        }
        Set<UUID> blocked = new HashSet<>(billLineRepository.findBlockedOrderIds(byOrder.keySet(), BLOCKING));
        List<DueLine> lines = new ArrayList<>();
        for (DueLine line : byOrder.values()) {
            if (!blocked.contains(line.orderId()) && line.amount().compareTo(BigDecimal.ZERO) > 0) {
                lines.add(line);
            }
        }
        lines.sort(Comparator.comparing(DueLine::closeDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(DueLine::orderNumber, Comparator.nullsLast(String::compareToIgnoreCase)));
        return lines;
    }

    /** Oldest cash is treated as sent first. What remains is still at the hub. */
    private static List<DueLine> stillAtHub(List<DueLine> oldestFirst, BigDecimal balance) {
        BigDecimal pool = oldestFirst.stream()
                .map(DueLine::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal covered = pool.subtract(balance);
        if (covered.compareTo(BigDecimal.ZERO) < 0) {
            covered = BigDecimal.ZERO;
        }
        List<DueLine> left = new ArrayList<>();
        for (DueLine line : oldestFirst) {
            if (covered.compareTo(BigDecimal.ZERO) <= 0) {
                left.add(line);
                continue;
            }
            if (line.amount().compareTo(covered) <= 0) {
                covered = covered.subtract(line.amount());
                continue;
            }
            left.add(new DueLine(
                    line.orderId(),
                    line.orderNumber(),
                    line.closeDate(),
                    line.amount().subtract(covered).setScale(2, RoundingMode.HALF_UP)));
            covered = BigDecimal.ZERO;
        }
        return left;
    }

    private static LocalDate earlier(LocalDate a, LocalDate b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isBefore(b) ? a : b;
    }

    private static BigDecimal scale(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }
}
