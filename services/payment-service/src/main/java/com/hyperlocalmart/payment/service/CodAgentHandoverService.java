package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.VendorClient;
import com.hyperlocalmart.payment.dto.request.ConfirmCodHandoverRequest;
import com.hyperlocalmart.payment.dto.request.DeclareCodHandoverRequest;
import com.hyperlocalmart.payment.dto.response.CodAgentHandoverResponse;
import com.hyperlocalmart.payment.dto.response.CodAgentHandoverSummaryResponse;
import com.hyperlocalmart.payment.entity.*;
import com.hyperlocalmart.payment.repository.CodAgentHandoverLineRepository;
import com.hyperlocalmart.payment.repository.CodAgentHandoverRepository;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import com.hyperlocalmart.payment.repository.CodCloseDayRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CodAgentHandoverService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal MATCH_TOLERANCE = new BigDecimal("0.01");
    /** How far back to include delivered COD still with the agent (undeclared). */
    private static final int PENDING_COD_LOOKBACK_DAYS = 365;
    /** Recent declarations shown on the agent handover screen. */
    private static final int RECENT_HANDOVER_DAYS = 90;

    private final CodAgentHandoverRepository handoverRepository;
    private final CodAgentHandoverLineRepository handoverLineRepository;
    private final CodCloseDayRepository codCloseDayRepository;
    private final CodCloseDayLineItemRepository codCloseDayLineItemRepository;
    private final OrderClient orderClient;
    private final DeliveryClient deliveryClient;
    private final VendorClient vendorClient;

    public CodAgentHandoverSummaryResponse agentSummary(UUID agentUserId) {
        DeliveryClient.AgentContext agent = deliveryClient.getAgentByUserId(agentUserId);
        LocalDate today = LocalDate.now(IST);
        LocalDate from = today.minusDays(PENDING_COD_LOOKBACK_DAYS);
        var delivered = orderClient.getCodDeliveredRange(agent.townId(), agent.agentId(), from, today);
        List<UUID> orderIds = delivered.items().stream().map(OrderClient.CodDeliveredItem::orderId).toList();
        Set<UUID> closed = new HashSet<>(submittedHandoverOrderIds(orderIds));
        closed.addAll(codCloseDayLineItemRepository.findClosedOrderIds(orderIds));

        List<OrderClient.CodDeliveredItem> pendingItems = delivered.items().stream()
                .filter(i -> !closed.contains(i.orderId()))
                .toList();

        BigDecimal pending = pendingItems.stream()
                .map(OrderClient.CodDeliveredItem::totalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal pendingHub = BigDecimal.ZERO;
        BigDecimal pendingVendor = BigDecimal.ZERO;
        for (OrderClient.CodDeliveredItem item : pendingItems) {
            BigDecimal amt = item.totalAmount() != null ? item.totalAmount() : BigDecimal.ZERO;
            if ("VENDOR".equalsIgnoreCase(custodianTypeForItem(item))) {
                pendingVendor = pendingVendor.add(amt);
            } else {
                pendingHub = pendingHub.add(amt);
            }
        }

        LocalDate handoverHistoryFrom = today.minusDays(RECENT_HANDOVER_DAYS);
        List<CodAgentHandover> recentHandovers =
                handoversForAgentBetween(agent.agentId(), handoverHistoryFrom, today);

        return CodAgentHandoverSummaryResponse.builder()
                .handoverDate(today.toString())
                .agentId(agent.agentId())
                .pendingCollectTotal(pending.setScale(2, RoundingMode.HALF_UP))
                .pendingHubTotal(pendingHub.setScale(2, RoundingMode.HALF_UP))
                .pendingVendorTotal(pendingVendor.setScale(2, RoundingMode.HALF_UP))
                .pendingOrderCount(pendingItems.size())
                .handovers(recentHandovers.stream().map(this::toSummaryResponse).toList())
                .orders(pendingItems.stream()
                        .sorted(Comparator.comparing(
                                        OrderClient.CodDeliveredItem::deliveredAt,
                                        Comparator.nullsLast(Comparator.naturalOrder()))
                                .reversed())
                        .map(i -> CodAgentHandoverSummaryResponse.OrderRow.builder()
                                .orderId(i.orderId())
                                .orderNumber(i.orderNumber())
                                .collectAmount(i.totalAmount())
                                .deliveredAt(i.deliveredAt())
                                .remittanceStatus("PENDING")
                                .custodianType(custodianTypeForItem(i))
                                .build())
                        .toList())
                .build();
    }

    @Transactional
    public CodAgentHandoverResponse declare(UUID agentUserId, DeclareCodHandoverRequest request) {
        LocalDate date = request.getHandoverDate() != null ? request.getHandoverDate() : LocalDate.now(IST);
        List<UUID> orderIds = request.getOrderIds().stream().filter(Objects::nonNull).distinct().toList();
        if (orderIds.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Select at least one COD order");
        }

        DeliveryClient.AgentContext agent = deliveryClient.getAgentByUserId(agentUserId);
        List<OrderClient.CodCashBreakdown> breakdowns = orderClient.codCashBreakdown(orderIds);
        if (breakdowns.size() != orderIds.size()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "One or more orders are not eligible COD deliveries");
        }

        List<UUID> taken = handoverLineRepository.findExistingOrderIds(orderIds);
        if (!taken.isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Some orders are already in a handover");
        }
        Set<UUID> closed = new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(orderIds));
        if (!closed.isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Some orders are already remitted to hub or vendor");
        }

        CodCustodianType custodianType = resolveCustodianType(breakdowns.getFirst());
        UUID hubId = breakdowns.getFirst().hubId();
        UUID vendorId = breakdowns.getFirst().vendorId();
        for (OrderClient.CodCashBreakdown row : breakdowns) {
            CodCustodianType rowType = resolveCustodianType(row);
            if (rowType != custodianType) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "All orders in one handover must share the same custodian");
            }
        }

        BigDecimal declared = breakdowns.stream()
                .map(OrderClient.CodCashBreakdown::collectAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        CodAgentHandover handover = CodAgentHandover.builder()
                .townId(agent.townId())
                .agentId(agent.agentId())
                .agentUserId(agentUserId)
                .custodianType(custodianType)
                .hubId(custodianType == CodCustodianType.HUB ? hubId : null)
                .vendorId(custodianType == CodCustodianType.VENDOR ? vendorId : null)
                .handoverDate(date)
                .declaredAmount(declared)
                .status(CodAgentHandoverStatus.DECLARED)
                .build();
        handover.setCreatedBy(agentUserId);
        handover.setUpdatedBy(agentUserId);

        for (OrderClient.CodCashBreakdown row : breakdowns) {
            CodAgentHandoverLine line = CodAgentHandoverLine.builder()
                    .handover(handover)
                    .orderId(row.orderId())
                    .orderNumber(row.orderNumber())
                    .collectAmount(row.collectAmount())
                    .build();
            line.setCreatedBy(agentUserId);
            line.setUpdatedBy(agentUserId);
            if (row.vendorAllocations() != null) {
                for (OrderClient.VendorAllocation alloc : row.vendorAllocations()) {
                    CodAgentHandoverAllocation a = CodAgentHandoverAllocation.builder()
                            .handoverLine(line)
                            .subOrderId(alloc.subOrderId())
                            .vendorId(alloc.vendorId())
                            .subOrderNumber(alloc.subOrderNumber())
                            .goodsSubtotal(alloc.goodsSubtotal())
                            .allocatedCash(alloc.allocatedCash())
                            .build();
                    a.setCreatedBy(agentUserId);
                    a.setUpdatedBy(agentUserId);
                    line.getAllocations().add(a);
                }
            }
            handover.getLines().add(line);
        }

        return toResponse(handoverRepository.save(handover));
    }

    @Transactional
    public CodCloseDay confirm(UUID actorUserId, ConfirmCodHandoverRequest request, boolean superAdmin) {
        CodAgentHandover handover = handoverRepository.findDetailedById(request.getHandoverId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Handover not found"));
        if (handover.getStatus() != CodAgentHandoverStatus.DECLARED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Handover is already closed");
        }

        assertCustodianActor(actorUserId, handover, superAdmin, request.getPin(), request.getVendorId());

        BigDecimal expected = handover.getDeclaredAmount();
        BigDecimal received = request.getReceivedAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal diff = expected.subtract(received).abs();
        CodCloseDayStatus closeStatus = diff.compareTo(MATCH_TOLERANCE) < 0
                ? CodCloseDayStatus.MATCHED
                : CodCloseDayStatus.DISCREPANCY;
        CodAgentHandoverStatus handoverStatus = closeStatus == CodCloseDayStatus.MATCHED
                ? CodAgentHandoverStatus.CONFIRMED
                : CodAgentHandoverStatus.DISCREPANCY;

        CodCloseDay closeDay = CodCloseDay.builder()
                .townId(handover.getTownId())
                .hubId(handover.getHubId())
                .vendorId(handover.getVendorId())
                .custodianType(handover.getCustodianType())
                .agentHandoverId(handover.getId())
                .agentId(handover.getAgentId())
                .closeDate(handover.getHandoverDate())
                .expectedAmount(expected)
                .receivedAmount(received)
                .orderCount(handover.getLines().size())
                .status(closeStatus)
                .notes(request.getNotes())
                .build();
        closeDay.setCreatedBy(actorUserId);
        closeDay.setUpdatedBy(actorUserId);

        for (CodAgentHandoverLine line : handover.getLines()) {
            CodCloseDayLineItem closeLine = CodCloseDayLineItem.builder()
                    .closeDay(closeDay)
                    .orderId(line.getOrderId())
                    .orderNumber(line.getOrderNumber())
                    .amount(line.getCollectAmount())
                    .build();
            closeLine.setCreatedBy(actorUserId);
            closeLine.setUpdatedBy(actorUserId);
            for (CodAgentHandoverAllocation alloc : line.getAllocations()) {
                CodCloseDayAllocation ca = CodCloseDayAllocation.builder()
                        .closeDayLine(closeLine)
                        .subOrderId(alloc.getSubOrderId())
                        .vendorId(alloc.getVendorId())
                        .subOrderNumber(alloc.getSubOrderNumber())
                        .goodsSubtotal(alloc.getGoodsSubtotal())
                        .allocatedCash(alloc.getAllocatedCash())
                        .build();
                ca.setCreatedBy(actorUserId);
                ca.setUpdatedBy(actorUserId);
                closeLine.getAllocations().add(ca);
            }
            closeDay.getLineItems().add(closeLine);
        }

        handover.setStatus(handoverStatus);
        handover.setUpdatedBy(actorUserId);
        handoverRepository.save(handover);
        return codCloseDayRepository.save(closeDay);
    }

    @Transactional(readOnly = true)
    public List<CodAgentHandoverResponse> listPendingForCustodian(
            UUID actorUserId, UUID townId, UUID hubId, UUID vendorId, LocalDate date, boolean superAdmin) {
        List<CodAgentHandover> handovers = handoverRepository.findByStatusAndHandoverDate(CodAgentHandoverStatus.DECLARED, date).stream()
                .filter(h -> townId == null || townId.equals(h.getTownId()))
                .filter(h -> hubId == null || hubId.equals(h.getHubId()))
                .filter(h -> vendorId == null || vendorId.equals(h.getVendorId()))
                .toList();
        Map<UUID, DeliveryClient.AgentSummary> agents = agentDirectoryForHandovers(handovers, hubId, vendorId);
        return handovers.stream()
                .map(h -> toResponse(h, agents.get(h.getAgentId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CodAgentHandoverResponse> oversight(UUID townId, LocalDate from, LocalDate to) {
        return handoverRepository.findByTownIdAndHandoverDateBetweenOrderByHandoverDateDesc(townId, from, to).stream()
                .map(this::toResponse)
                .toList();
    }

    private void assertCustodianActor(
            UUID actorUserId,
            CodAgentHandover handover,
            boolean superAdmin,
            String pin,
            UUID vendorIdFromRequest) {
        if (superAdmin) {
            return;
        }
        if (handover.getCustodianType() == CodCustodianType.HUB) {
            DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(actorUserId);
            if (handover.getHubId() != null && !handover.getHubId().equals(hub.hubId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Handover is for another hub");
            }
            if (pin == null || pin.isBlank()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hub PIN is required");
            }
            deliveryClient.verifyHubPin(actorUserId, pin);
            return;
        }
        if (handover.getVendorId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Handover has no vendor custodian");
        }
        if (vendorIdFromRequest == null || !handover.getVendorId().equals(vendorIdFromRequest)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Handover is for another shop");
        }
        if (pin == null || pin.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Shop COD PIN is required");
        }
        vendorClient.verifyVendorCodPin(handover.getVendorId(), pin);
    }

    private static CodCustodianType resolveCustodianType(OrderClient.CodCashBreakdown row) {
        return "VENDOR".equalsIgnoreCase(row.custodianType()) ? CodCustodianType.VENDOR : CodCustodianType.HUB;
    }

    private Map<UUID, DeliveryClient.AgentSummary> agentDirectoryForHandovers(
            List<CodAgentHandover> handovers, UUID hubId, UUID vendorId) {
        List<DeliveryClient.AgentSummary> roster = new ArrayList<>();
        if (vendorId != null) {
            roster.addAll(deliveryClient.listVendorAgents(vendorId));
        } else if (hubId != null) {
            roster.addAll(deliveryClient.listHubAgents(hubId));
        } else {
            Set<UUID> hubIds = handovers.stream()
                    .map(CodAgentHandover::getHubId)
                    .filter(Objects::nonNull)
                    .collect(java.util.stream.Collectors.toSet());
            for (UUID id : hubIds) {
                roster.addAll(deliveryClient.listHubAgents(id));
            }
        }
        Map<UUID, DeliveryClient.AgentSummary> map = new HashMap<>();
        for (DeliveryClient.AgentSummary agent : roster) {
            if (agent.agentId() != null) {
                map.putIfAbsent(agent.agentId(), agent);
            }
        }
        return map;
    }

    private static String custodianTypeForItem(OrderClient.CodDeliveredItem item) {
        if (item.custodianType() != null && !item.custodianType().isBlank()) {
            return "VENDOR".equalsIgnoreCase(item.custodianType()) ? "VENDOR" : "HUB";
        }
        return "HUB";
    }

    private List<UUID> submittedHandoverOrderIds(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        try {
            return handoverLineRepository.findExistingOrderIds(orderIds);
        } catch (DataAccessException ex) {
            if (isMissingHandoverSchema(ex)) {
                log.warn("COD handover tables unavailable — apply payment-service Flyway V17 and restart");
                return List.of();
            }
            throw ex;
        }
    }

    private List<CodAgentHandover> handoversForAgentBetween(UUID agentId, LocalDate from, LocalDate to) {
        try {
            return handoverRepository.findRecentWithLinesForAgent(agentId, from, to);
        } catch (DataAccessException ex) {
            if (isMissingHandoverSchema(ex)) {
                log.warn("COD handover tables unavailable — apply payment-service Flyway V17 and restart");
                return List.of();
            }
            throw ex;
        }
    }

    private static boolean isMissingHandoverSchema(DataAccessException ex) {
        Throwable t = ex;
        while (t != null) {
            String msg = t.getMessage();
            if (msg != null && msg.contains("cod_agent_handover")) {
                return true;
            }
            t = t.getCause();
        }
        return false;
    }

    /** Agent summary list — line count only, no vendor allocation slices. */
    private CodAgentHandoverResponse toSummaryResponse(CodAgentHandover handover) {
        return buildResponse(handover, null, null, false);
    }

    private CodAgentHandoverResponse toResponse(CodAgentHandover handover) {
        return buildResponse(handover, null, null, true);
    }

    private CodAgentHandoverResponse toResponse(CodAgentHandover handover, DeliveryClient.AgentSummary agent) {
        String agentName = agent != null && agent.name() != null && !agent.name().isBlank()
                ? agent.name()
                : null;
        String agentPhone = agent != null ? agent.phone() : null;
        return buildResponse(handover, agentName, agentPhone, true);
    }

    private CodAgentHandoverResponse buildResponse(
            CodAgentHandover handover, String agentName, String agentPhone, boolean withAllocations) {
        return CodAgentHandoverResponse.builder()
                .handoverId(handover.getId())
                .agentId(handover.getAgentId())
                .agentName(agentName)
                .agentPhone(agentPhone)
                .handoverDate(handover.getHandoverDate().toString())
                .custodianType(handover.getCustodianType().name())
                .hubId(handover.getHubId())
                .vendorId(handover.getVendorId())
                .declaredAmount(handover.getDeclaredAmount())
                .status(handover.getStatus().name())
                .lines(handover.getLines().stream()
                        .map(l -> {
                            CodAgentHandoverResponse.Line.LineBuilder lb = CodAgentHandoverResponse.Line.builder()
                                    .orderId(l.getOrderId())
                                    .orderNumber(l.getOrderNumber())
                                    .collectAmount(l.getCollectAmount());
                            if (withAllocations) {
                                lb.vendorAllocations(l.getAllocations().stream()
                                        .map(a -> CodAgentHandoverResponse.VendorSlice.builder()
                                                .subOrderId(a.getSubOrderId())
                                                .vendorId(a.getVendorId())
                                                .subOrderNumber(a.getSubOrderNumber())
                                                .goodsSubtotal(a.getGoodsSubtotal())
                                                .allocatedCash(a.getAllocatedCash())
                                                .build())
                                        .toList());
                            }
                            return lb.build();
                        })
                        .toList())
                .build();
    }
}
