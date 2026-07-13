package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.dto.response.HubReportResponse;
import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.DeliveryAgent;
import com.hyperlocalmart.delivery.entity.DeliveryHub;
import com.hyperlocalmart.delivery.entity.HubAdmin;
import com.hyperlocalmart.delivery.repository.AgentHubLinkRepository;
import com.hyperlocalmart.delivery.repository.DeliveryAgentRepository;
import com.hyperlocalmart.delivery.repository.DeliveryAssignmentRepository;
import com.hyperlocalmart.delivery.repository.DeliveryHubRepository;
import com.hyperlocalmart.delivery.repository.HubAdminRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HubReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String HUB_ADMIN_ACTIVE = "ACTIVE";
    private static final int MAX_RANGE_DAYS = 90;

    private final HubAdminRepository hubAdminRepository;
    private final DeliveryHubRepository deliveryHubRepository;
    private final AgentHubLinkRepository agentHubLinkRepository;
    private final DeliveryAgentRepository deliveryAgentRepository;
    private final DeliveryAssignmentRepository deliveryAssignmentRepository;
    private final OrderClient orderClient;

    @Transactional(readOnly = true)
    public HubReportResponse getReport(UUID hubAdminUserId, UUID hubId, LocalDate from, LocalDate to) {
        validateDateRange(from, to);
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        if (!hubAdmin.getHubId().equals(hubId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub does not belong to admin");
        }
        DeliveryHub hub = deliveryHubRepository.findById(hubId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));

        var start = from.atStartOfDay(IST).toInstant();
        var end = to.plusDays(1).atStartOfDay(IST).toInstant();

        OrderClient.HubTownReportStats orderStats =
                orderClient.getHubTownReportStats(hub.getTownId(), from, to);

        long pickups = deliveryAssignmentRepository.countCompletedByHubIdAndLegTypeBetween(
                hubId, AssignmentLegType.PICKUP, start, end);
        long lastMile = deliveryAssignmentRepository.countCompletedByHubIdAndLegTypeBetween(
                hubId, AssignmentLegType.LAST_MILE, start, end);

        Map<UUID, long[]> byAgent = new HashMap<>();
        for (Object[] row : deliveryAssignmentRepository.countCompletedGroupedByAgentAndLeg(hubId, start, end)) {
            UUID agentId = (UUID) row[0];
            AssignmentLegType leg = (AssignmentLegType) row[1];
            long count = ((Number) row[2]).longValue();
            long[] counts = byAgent.computeIfAbsent(agentId, id -> new long[2]);
            if (leg == AssignmentLegType.PICKUP) {
                counts[0] = count;
            } else if (leg == AssignmentLegType.LAST_MILE) {
                counts[1] = count;
            }
        }

        List<HubReportResponse.AgentPerformanceRow> agents = new ArrayList<>();
        for (var link : agentHubLinkRepository.findByHubIdAndActiveTrue(hubId)) {
            DeliveryAgent agent = deliveryAgentRepository.findById(link.getAgentId()).orElse(null);
            if (agent == null) continue;
            long[] counts = byAgent.getOrDefault(agent.getId(), new long[] {0, 0});
            agents.add(HubReportResponse.AgentPerformanceRow.builder()
                    .agentId(agent.getId())
                    .name(agent.getName())
                    .phone(agent.getPhone())
                    .status(agent.getStatus().name())
                    .shopPickupsCompleted(counts[0])
                    .homeDeliveriesCompleted(counts[1])
                    .totalCompleted(counts[0] + counts[1])
                    .build());
        }
        agents.sort(Comparator.comparingLong(HubReportResponse.AgentPerformanceRow::getTotalCompleted).reversed());

        return HubReportResponse.builder()
                .hubId(hub.getId())
                .townId(hub.getTownId())
                .hubName(hub.getName())
                .from(from)
                .to(to)
                .ordersPlaced(orderStats.ordersPlaced())
                .ordersDelivered(orderStats.ordersDelivered())
                .ordersCancelled(orderStats.ordersCancelled())
                .subOrdersPlaced(orderStats.subOrdersPlaced())
                .bagsMarkedReady(orderStats.bagsMarkedReady())
                .shopPickupsCompleted(pickups)
                .homeDeliveriesCompleted(lastMile)
                .agents(agents)
                .build();
    }

    private HubAdmin resolveActiveHubAdmin(UUID hubAdminUserId) {
        return hubAdminRepository.findByUserIdAndStatus(hubAdminUserId, HUB_ADMIN_ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "Active hub admin not found"));
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
