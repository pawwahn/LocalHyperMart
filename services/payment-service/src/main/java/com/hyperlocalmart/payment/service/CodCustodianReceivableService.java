package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.OrderClient.CodDeliveredItem;
import com.hyperlocalmart.payment.dto.response.CodCustodianOutstandingResponse;
import com.hyperlocalmart.payment.dto.response.CodCustodianOutstandingResponse.AgentOutstanding;
import com.hyperlocalmart.payment.dto.response.CodCustodianReceivableResponse;
import com.hyperlocalmart.payment.dto.response.CodCustodianReceivableResponse.AgentReceivable;
import com.hyperlocalmart.payment.dto.response.CodCustodianReceivableResponse.DeclaredHandover;
import com.hyperlocalmart.payment.dto.response.CodCustodianPendingDetailResponse;
import com.hyperlocalmart.payment.dto.response.CodCustodianPendingDetailResponse.AgentBucket;
import com.hyperlocalmart.payment.dto.response.CodCustodianPendingDetailResponse.DayBucket;
import com.hyperlocalmart.payment.dto.response.CodCustodianPendingDetailResponse.DeclaredHandoverRow;
import com.hyperlocalmart.payment.dto.response.CodCustodianPendingDetailResponse.OrderRow;
import com.hyperlocalmart.payment.dto.response.CodCustodianReceivableResponse.OrderDue;
import com.hyperlocalmart.payment.entity.CodAgentHandover;
import com.hyperlocalmart.payment.entity.CodAgentHandoverStatus;
import com.hyperlocalmart.payment.entity.CodCustodianType;
import com.hyperlocalmart.payment.repository.CodAgentHandoverLineRepository;
import com.hyperlocalmart.payment.repository.CodAgentHandoverRepository;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CodCustodianReceivableService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    /** Delivered COD older than this is omitted from the all-dates banner (adjust if needed). */
    private static final int OUTSTANDING_LOOKBACK_DAYS = 120;

    private final OrderClient orderClient;
    private final DeliveryClient deliveryClient;
    private final CodCloseDayLineItemRepository codCloseDayLineItemRepository;
    private final CodAgentHandoverLineRepository handoverLineRepository;
    private final CodAgentHandoverRepository handoverRepository;

    @Transactional(readOnly = true)
    public CodCustodianReceivableResponse receivables(
            UUID townId, LocalDate date, UUID hubId, UUID vendorId) {
        if (townId == null || date == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "townId and date are required");
        }
        if (hubId == null && vendorId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "hubId or vendorId is required");
        }
        if (hubId != null && vendorId != null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Provide hubId or vendorId, not both");
        }

        CodCustodianType custodianType = vendorId != null ? CodCustodianType.VENDOR : CodCustodianType.HUB;
        List<DeliveryClient.AgentSummary> agents = vendorId != null
                ? deliveryClient.listVendorAgents(vendorId)
                : deliveryClient.listHubAgents(hubId);

        List<CodAgentHandover> declaredHandovers = handoverRepository
                .findByStatusAndHandoverDate(CodAgentHandoverStatus.DECLARED, date).stream()
                .filter(h -> h.getCustodianType() == custodianType)
                .filter(h -> vendorId != null ? vendorId.equals(h.getVendorId()) : hubId.equals(h.getHubId()))
                .toList();

        Map<UUID, List<CodAgentHandover>> declaredByAgent = declaredHandovers.stream()
                .collect(Collectors.groupingBy(CodAgentHandover::getAgentId));

        BigDecimal totalStill = BigDecimal.ZERO;
        int countStill = 0;
        BigDecimal totalAwaiting = BigDecimal.ZERO;
        int countAwaiting = 0;
        List<AgentReceivable> agentRows = new ArrayList<>();

        Map<UUID, String> rosterAgentNames = agents.stream()
                .filter(a -> a.agentId() != null)
                .collect(Collectors.toMap(DeliveryClient.AgentSummary::agentId, DeliveryClient.AgentSummary::name, (a, b) -> a));

        Set<UUID> rosterAgentIds = new HashSet<>(rosterAgentNames.keySet());

        for (DeliveryClient.AgentSummary agent : agents) {
            UUID agentId = agent.agentId();
            var delivered = orderClient.getCodDelivered(townId, agentId, date);
            List<CodDeliveredItem> items = filterForCustodian(
                    delivered.items() == null ? List.of() : delivered.items(), custodianType);
            List<UUID> orderIds = items.stream().map(CodDeliveredItem::orderId).toList();
            Set<UUID> remitted = orderIds.isEmpty()
                    ? Set.of()
                    : new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(orderIds));
            Set<UUID> declaredOrderIds = new HashSet<>(handoverLineRepository.findDeclaredHandoverOrderIds(
                    agentId, date, CodAgentHandoverStatus.DECLARED));

            List<OrderDue> stillWithAgent = new ArrayList<>();
            for (CodDeliveredItem item : items) {
                if (remitted.contains(item.orderId()) || declaredOrderIds.contains(item.orderId())) {
                    continue;
                }
                stillWithAgent.add(toOrderDue(item));
            }

            List<DeclaredHandover> awaiting = declaredByAgent.getOrDefault(agentId, List.of()).stream()
                    .map(h -> DeclaredHandover.builder()
                            .handoverId(h.getId())
                            .declaredAmount(h.getDeclaredAmount())
                            .lines(h.getLines().stream().map(l -> OrderDue.builder()
                                    .orderId(l.getOrderId())
                                    .orderNumber(l.getOrderNumber())
                                    .collectAmount(l.getCollectAmount())
                                    .deliveredAt(null)
                                    .build()).toList())
                            .build())
                    .toList();

            BigDecimal stillAmt = stillWithAgent.stream()
                    .map(OrderDue::getCollectAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal awaitAmt = awaiting.stream()
                    .map(DeclaredHandover::getDeclaredAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            int awaitOrders = awaiting.stream().mapToInt(h -> h.getLines().size()).sum();

            if (stillWithAgent.isEmpty() && awaiting.isEmpty()) {
                continue;
            }

            totalStill = totalStill.add(stillAmt);
            countStill += stillWithAgent.size();
            totalAwaiting = totalAwaiting.add(awaitAmt);
            countAwaiting += awaiting.size();

            agentRows.add(AgentReceivable.builder()
                    .agentId(agentId)
                    .agentName(agent.name())
                    .stillWithAgentAmount(stillAmt.setScale(2, RoundingMode.HALF_UP))
                    .stillWithAgentOrderCount(stillWithAgent.size())
                    .declaredAwaitingAmount(awaitAmt.setScale(2, RoundingMode.HALF_UP))
                    .declaredAwaitingOrderCount(awaitOrders)
                    .stillWithAgentOrders(stillWithAgent)
                    .declaredAwaitingConfirm(awaiting)
                    .build());
        }

        appendDeclaredAgentsNotOnRoster(agentRows, declaredHandovers, rosterAgentIds, rosterAgentNames);

        agentRows.sort(Comparator.comparing(AgentReceivable::getAgentName, Comparator.nullsLast(String::compareToIgnoreCase)));

        BigDecimal totalStillFinal = agentRows.stream()
                .map(AgentReceivable::getStillWithAgentAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int countStillFinal = agentRows.stream().mapToInt(AgentReceivable::getStillWithAgentOrderCount).sum();
        BigDecimal totalAwaitFinal = agentRows.stream()
                .map(AgentReceivable::getDeclaredAwaitingAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int countAwaitFinal = agentRows.stream().mapToInt(AgentReceivable::getDeclaredAwaitingOrderCount).sum();

        return CodCustodianReceivableResponse.builder()
                .date(date.toString())
                .townId(townId)
                .hubId(hubId)
                .vendorId(vendorId)
                .totalStillWithAgents(totalStillFinal.setScale(2, RoundingMode.HALF_UP))
                .ordersStillWithAgents(countStillFinal)
                .totalDeclaredAwaitingConfirm(totalAwaitFinal.setScale(2, RoundingMode.HALF_UP))
                .handoversAwaitingConfirm(countAwaitFinal)
                .agents(agentRows)
                .build();
    }

    @Transactional(readOnly = true)
    public CodCustodianPendingDetailResponse pendingDetail(UUID townId, UUID hubId, UUID vendorId) {
        if (townId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "townId is required");
        }
        if (hubId == null && vendorId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "hubId or vendorId is required");
        }
        if (hubId != null && vendorId != null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Provide hubId or vendorId, not both");
        }

        LocalDate to = LocalDate.now(IST);
        LocalDate from = to.minusDays(OUTSTANDING_LOOKBACK_DAYS);
        CodCustodianType custodianType = vendorId != null ? CodCustodianType.VENDOR : CodCustodianType.HUB;
        List<DeliveryClient.AgentSummary> agents = vendorId != null
                ? deliveryClient.listVendorAgents(vendorId)
                : deliveryClient.listHubAgents(hubId);

        Map<UUID, String> agentNames = agents.stream()
                .filter(a -> a.agentId() != null)
                .collect(Collectors.toMap(DeliveryClient.AgentSummary::agentId, DeliveryClient.AgentSummary::name, (a, b) -> a));

        List<CodAgentHandover> declaredHandovers = vendorId != null
                ? handoverRepository.findDeclaredByVendorBetween(
                        CodAgentHandoverStatus.DECLARED, custodianType, vendorId, from, to)
                : handoverRepository.findDeclaredByHubBetween(
                        CodAgentHandoverStatus.DECLARED, custodianType, hubId, from, to);

        Map<String, Map<UUID, MutableAgentDay>> dayMap = new TreeMap<>(Comparator.reverseOrder());

        for (DeliveryClient.AgentSummary agent : agents) {
            UUID agentId = agent.agentId();
            String agentName = agent.name();
            var delivered = orderClient.getCodDeliveredRange(townId, agentId, from, to);
            List<CodDeliveredItem> items = filterForCustodian(
                    delivered.items() == null ? List.of() : delivered.items(), custodianType);
            List<UUID> orderIds = items.stream().map(CodDeliveredItem::orderId).toList();
            Set<UUID> remitted = orderIds.isEmpty()
                    ? Set.of()
                    : new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(orderIds));
            Set<UUID> declaredOrderIds = new HashSet<>(handoverLineRepository.findDeclaredHandoverOrderIdsBetween(
                    agentId, from, to, CodAgentHandoverStatus.DECLARED));

            for (CodDeliveredItem item : items) {
                if (remitted.contains(item.orderId()) || declaredOrderIds.contains(item.orderId())) {
                    continue;
                }
                String day = istDateKey(item.deliveredAt());
                MutableAgentDay bucket = dayMap
                        .computeIfAbsent(day, d -> new LinkedHashMap<>())
                        .computeIfAbsent(agentId, id -> new MutableAgentDay(agentId, agentName));
                bucket.stillOrders.add(toOrderRow(item));
            }
        }

        List<DeclaredHandoverRow> declaredFlat = new ArrayList<>();
        for (CodAgentHandover handover : declaredHandovers) {
            UUID agentId = handover.getAgentId();
            String agentName = agentNames.getOrDefault(agentId, "Delivery agent");
            String day = handover.getHandoverDate().toString();
            DeclaredHandoverRow row = DeclaredHandoverRow.builder()
                    .handoverId(handover.getId())
                    .agentId(agentId)
                    .agentName(agentName)
                    .handoverDate(day)
                    .declaredAmount(handover.getDeclaredAmount())
                    .lines(handover.getLines().stream()
                            .map(l -> OrderRow.builder()
                                    .orderId(l.getOrderId())
                                    .orderNumber(l.getOrderNumber())
                                    .collectAmount(l.getCollectAmount())
                                    .deliveredAt(null)
                                    .build())
                            .toList())
                    .build();
            declaredFlat.add(row);

            MutableAgentDay bucket = dayMap
                    .computeIfAbsent(day, d -> new LinkedHashMap<>())
                    .computeIfAbsent(agentId, id -> new MutableAgentDay(agentId, agentName));
            bucket.declared.add(row);
        }

        declaredFlat.sort(Comparator
                .comparing(DeclaredHandoverRow::getHandoverDate, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(DeclaredHandoverRow::getAgentName, Comparator.nullsLast(String::compareToIgnoreCase)));

        List<DayBucket> days = new ArrayList<>();
        BigDecimal totalStill = BigDecimal.ZERO;
        int countStill = 0;
        BigDecimal totalAwait = BigDecimal.ZERO;

        for (Map.Entry<String, Map<UUID, MutableAgentDay>> dayEntry : dayMap.entrySet()) {
            List<AgentBucket> agentBuckets = new ArrayList<>();
            BigDecimal dayStill = BigDecimal.ZERO;
            int dayStillCount = 0;
            BigDecimal dayAwait = BigDecimal.ZERO;
            int dayAwaitCount = 0;

            for (MutableAgentDay mut : dayEntry.getValue().values()) {
                BigDecimal stillAmt = mut.stillOrders.stream()
                        .map(OrderRow::getCollectAmount)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal awaitAmt = mut.declared.stream()
                        .map(DeclaredHandoverRow::getDeclaredAmount)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                int awaitOrders = mut.declared.stream().mapToInt(h -> h.getLines().size()).sum();

                if (mut.stillOrders.isEmpty() && mut.declared.isEmpty()) {
                    continue;
                }

                dayStill = dayStill.add(stillAmt);
                dayStillCount += mut.stillOrders.size();
                dayAwait = dayAwait.add(awaitAmt);
                dayAwaitCount += awaitOrders;

                agentBuckets.add(AgentBucket.builder()
                        .agentId(mut.agentId)
                        .agentName(mut.agentName)
                        .stillWithAgentAmount(stillAmt.setScale(2, RoundingMode.HALF_UP))
                        .stillWithAgentOrderCount(mut.stillOrders.size())
                        .declaredAwaitingAmount(awaitAmt.setScale(2, RoundingMode.HALF_UP))
                        .declaredAwaitingOrderCount(awaitOrders)
                        .stillWithAgentOrders(List.copyOf(mut.stillOrders))
                        .declaredAwaiting(List.copyOf(mut.declared))
                        .build());
            }

            if (agentBuckets.isEmpty()) {
                continue;
            }
            agentBuckets.sort(Comparator.comparing(AgentBucket::getAgentName, Comparator.nullsLast(String::compareToIgnoreCase)));

            totalStill = totalStill.add(dayStill);
            countStill += dayStillCount;
            totalAwait = totalAwait.add(dayAwait);

            days.add(DayBucket.builder()
                    .date(dayEntry.getKey())
                    .stillWithAgentsAmount(dayStill.setScale(2, RoundingMode.HALF_UP))
                    .stillWithAgentsOrderCount(dayStillCount)
                    .declaredAwaitingAmount(dayAwait.setScale(2, RoundingMode.HALF_UP))
                    .declaredAwaitingOrderCount(dayAwaitCount)
                    .agents(agentBuckets)
                    .build());
        }

        return CodCustodianPendingDetailResponse.builder()
                .lookbackFrom(from.toString())
                .lookbackTo(to.toString())
                .townId(townId)
                .hubId(hubId)
                .vendorId(vendorId)
                .totalStillWithAgents(totalStill.setScale(2, RoundingMode.HALF_UP))
                .ordersStillWithAgents(countStill)
                .totalDeclaredAwaitingConfirm(totalAwait.setScale(2, RoundingMode.HALF_UP))
                .handoversAwaitingConfirm(declaredFlat.size())
                .days(days)
                .declaredAwaitingHandovers(declaredFlat)
                .build();
    }

    @Transactional(readOnly = true)
    public CodCustodianOutstandingResponse outstanding(UUID townId, UUID hubId, UUID vendorId) {
        if (townId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "townId is required");
        }
        if (hubId == null && vendorId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "hubId or vendorId is required");
        }
        if (hubId != null && vendorId != null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Provide hubId or vendorId, not both");
        }

        LocalDate to = LocalDate.now(IST);
        LocalDate from = to.minusDays(OUTSTANDING_LOOKBACK_DAYS);
        CodCustodianType custodianType = vendorId != null ? CodCustodianType.VENDOR : CodCustodianType.HUB;
        List<DeliveryClient.AgentSummary> agents = vendorId != null
                ? deliveryClient.listVendorAgents(vendorId)
                : deliveryClient.listHubAgents(hubId);

        List<CodAgentHandover> declaredHandovers = vendorId != null
                ? handoverRepository.findDeclaredByVendorBetween(
                        CodAgentHandoverStatus.DECLARED, custodianType, vendorId, from, to)
                : handoverRepository.findDeclaredByHubBetween(
                        CodAgentHandoverStatus.DECLARED, custodianType, hubId, from, to);

        Map<UUID, List<CodAgentHandover>> declaredByAgent = declaredHandovers.stream()
                .collect(Collectors.groupingBy(CodAgentHandover::getAgentId));

        BigDecimal totalStill = BigDecimal.ZERO;
        int countStill = 0;
        BigDecimal totalAwaiting = BigDecimal.ZERO;
        int countAwaiting = 0;
        List<AgentOutstanding> agentRows = new ArrayList<>();

        for (DeliveryClient.AgentSummary agent : agents) {
            UUID agentId = agent.agentId();
            var delivered = orderClient.getCodDeliveredRange(townId, agentId, from, to);
            List<CodDeliveredItem> items = filterForCustodian(
                    delivered.items() == null ? List.of() : delivered.items(), custodianType);
            List<UUID> orderIds = items.stream().map(CodDeliveredItem::orderId).toList();
            Set<UUID> remitted = orderIds.isEmpty()
                    ? Set.of()
                    : new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(orderIds));
            Set<UUID> declaredOrderIds = new HashSet<>(handoverLineRepository.findDeclaredHandoverOrderIdsBetween(
                    agentId, from, to, CodAgentHandoverStatus.DECLARED));

            BigDecimal stillAmt = BigDecimal.ZERO;
            int stillCount = 0;
            for (CodDeliveredItem item : items) {
                if (remitted.contains(item.orderId()) || declaredOrderIds.contains(item.orderId())) {
                    continue;
                }
                stillAmt = stillAmt.add(nullToZero(item.totalAmount()));
                stillCount++;
            }

            List<CodAgentHandover> awaitingHandovers = declaredByAgent.getOrDefault(agentId, List.of());
            BigDecimal awaitAmt = awaitingHandovers.stream()
                    .map(CodAgentHandover::getDeclaredAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            int awaitOrders = awaitingHandovers.stream().mapToInt(h -> h.getLines().size()).sum();

            if (stillCount == 0 && awaitingHandovers.isEmpty()) {
                continue;
            }

            totalStill = totalStill.add(stillAmt);
            countStill += stillCount;
            totalAwaiting = totalAwaiting.add(awaitAmt);
            countAwaiting += awaitingHandovers.size();

            agentRows.add(AgentOutstanding.builder()
                    .agentId(agentId)
                    .agentName(agent.name())
                    .stillWithAgentAmount(stillAmt.setScale(2, RoundingMode.HALF_UP))
                    .stillWithAgentOrderCount(stillCount)
                    .declaredAwaitingAmount(awaitAmt.setScale(2, RoundingMode.HALF_UP))
                    .declaredAwaitingOrderCount(awaitOrders)
                    .build());
        }

        agentRows.sort(Comparator.comparing(AgentOutstanding::getAgentName, Comparator.nullsLast(String::compareToIgnoreCase)));

        return CodCustodianOutstandingResponse.builder()
                .lookbackFrom(from.toString())
                .lookbackTo(to.toString())
                .townId(townId)
                .hubId(hubId)
                .vendorId(vendorId)
                .totalStillWithAgents(totalStill.setScale(2, RoundingMode.HALF_UP))
                .ordersStillWithAgents(countStill)
                .totalDeclaredAwaitingConfirm(totalAwaiting.setScale(2, RoundingMode.HALF_UP))
                .handoversAwaitingConfirm(countAwaiting)
                .agents(agentRows)
                .build();
    }

    private List<CodDeliveredItem> filterForCustodian(
            List<CodDeliveredItem> items, CodCustodianType custodianType) {
        if (items.isEmpty()) {
            return items;
        }
        List<UUID> orderIds = items.stream().map(CodDeliveredItem::orderId).filter(Objects::nonNull).toList();
        if (orderIds.isEmpty()) {
            return List.of();
        }
        Set<UUID> matching = orderClient.codCashBreakdown(orderIds).stream()
                .filter(b -> custodianType.name().equalsIgnoreCase(b.custodianType()))
                .map(OrderClient.CodCashBreakdown::orderId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        return items.stream().filter(i -> matching.contains(i.orderId())).toList();
    }

    private static void appendDeclaredAgentsNotOnRoster(
            List<AgentReceivable> agentRows,
            List<CodAgentHandover> declaredHandovers,
            Set<UUID> rosterAgentIds,
            Map<UUID, String> rosterAgentNames) {
        Map<UUID, List<CodAgentHandover>> byAgent = declaredHandovers.stream()
                .collect(Collectors.groupingBy(CodAgentHandover::getAgentId));
        for (Map.Entry<UUID, List<CodAgentHandover>> entry : byAgent.entrySet()) {
            UUID agentId = entry.getKey();
            if (rosterAgentIds.contains(agentId)) {
                continue;
            }
            List<DeclaredHandover> awaiting = entry.getValue().stream()
                    .map(h -> DeclaredHandover.builder()
                            .handoverId(h.getId())
                            .declaredAmount(h.getDeclaredAmount())
                            .lines(h.getLines().stream().map(l -> OrderDue.builder()
                                    .orderId(l.getOrderId())
                                    .orderNumber(l.getOrderNumber())
                                    .collectAmount(l.getCollectAmount())
                                    .deliveredAt(null)
                                    .build()).toList())
                            .build())
                    .toList();
            if (awaiting.isEmpty()) {
                continue;
            }
            BigDecimal awaitAmt = awaiting.stream()
                    .map(DeclaredHandover::getDeclaredAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            int awaitOrders = awaiting.stream().mapToInt(h -> h.getLines().size()).sum();
            String name = rosterAgentNames.getOrDefault(agentId, "Delivery agent");
            agentRows.add(AgentReceivable.builder()
                    .agentId(agentId)
                    .agentName(name)
                    .stillWithAgentAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                    .stillWithAgentOrderCount(0)
                    .declaredAwaitingAmount(awaitAmt.setScale(2, RoundingMode.HALF_UP))
                    .declaredAwaitingOrderCount(awaitOrders)
                    .stillWithAgentOrders(List.of())
                    .declaredAwaitingConfirm(awaiting)
                    .build());
        }
    }

    private static BigDecimal nullToZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static OrderDue toOrderDue(CodDeliveredItem item) {
        return OrderDue.builder()
                .orderId(item.orderId())
                .orderNumber(item.orderNumber())
                .collectAmount(item.totalAmount())
                .deliveredAt(item.deliveredAt())
                .build();
    }

    private static OrderRow toOrderRow(CodDeliveredItem item) {
        return OrderRow.builder()
                .orderId(item.orderId())
                .orderNumber(item.orderNumber())
                .collectAmount(item.totalAmount())
                .deliveredAt(item.deliveredAt())
                .build();
    }

    private static String istDateKey(Instant deliveredAt) {
        if (deliveredAt == null) {
            return "unknown";
        }
        return deliveredAt.atZone(IST).toLocalDate().toString();
    }

    private static final class MutableAgentDay {
        final UUID agentId;
        final String agentName;
        final List<OrderRow> stillOrders = new ArrayList<>();
        final List<DeclaredHandoverRow> declared = new ArrayList<>();

        MutableAgentDay(UUID agentId, String agentName) {
            this.agentId = agentId;
            this.agentName = agentName;
        }
    }
}
