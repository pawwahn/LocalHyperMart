package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.dto.response.HubDashboardResponse;
import com.hyperlocalmart.delivery.dto.response.HubDashboardResponse.LegStatusCounts;
import com.hyperlocalmart.delivery.dto.response.HubDashboardResponse.OrderQueueCounts;
import com.hyperlocalmart.delivery.dto.response.HubMeResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HubDashboardService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String HUB_ADMIN_ACTIVE = "ACTIVE";
    private static final List<AssignmentStatus> ACTIVE_ASSIGNMENT_STATUSES =
            List.of(AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS);

    private final HubAdminRepository hubAdminRepository;
    private final DeliveryHubRepository deliveryHubRepository;
    private final AgentHubLinkRepository agentHubLinkRepository;
    private final DeliveryAgentRepository deliveryAgentRepository;
    private final DeliveryAssignmentRepository deliveryAssignmentRepository;
    private final OrderClient orderClient;

    @Transactional(readOnly = true)
    public HubMeResponse getMyHub(UUID hubAdminUserId) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        DeliveryHub hub = deliveryHubRepository.findById(hubAdmin.getHubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));
        return HubMeResponse.builder()
                .hubId(hub.getId())
                .townId(hub.getTownId())
                .hubName(hub.getName())
                .address(hub.getAddress())
                .phone(hub.getPhone())
                .build();
    }

    @Transactional(readOnly = true)
    public HubDashboardResponse getDashboard(UUID hubAdminUserId, UUID hubId) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        if (!hubAdmin.getHubId().equals(hubId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub does not belong to admin");
        }

        DeliveryHub hub = deliveryHubRepository.findById(hubId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));

        Instant todayStart = startOfDay(LocalDate.now(IST));
        Instant todayEnd = exclusiveEndOfDay(LocalDate.now(IST));

        long activeAgents = agentHubLinkRepository.findByHubIdAndActiveTrue(hubId).stream()
                .map(link -> deliveryAgentRepository.findById(link.getAgentId()))
                .flatMap(java.util.Optional::stream)
                .filter(agent -> agent.getStatus() == AgentStatus.ACTIVE)
                .count();

        OrderClient.HubOrderStats orderStats = orderClient.getHubOrderStats(hub.getTownId());

        LegStatusCounts pickups = LegStatusCounts.builder()
                .assigned(deliveryAssignmentRepository.countByHubIdAndLegTypeAndStatus(
                        hubId, AssignmentLegType.PICKUP, AssignmentStatus.ASSIGNED))
                .inProgress(deliveryAssignmentRepository.countByHubIdAndLegTypeAndStatus(
                        hubId, AssignmentLegType.PICKUP, AssignmentStatus.IN_PROGRESS))
                .completedToday(deliveryAssignmentRepository.countCompletedByHubIdAndLegTypeBetween(
                        hubId, AssignmentLegType.PICKUP, todayStart, todayEnd))
                .build();

        LegStatusCounts lastMile = LegStatusCounts.builder()
                .assigned(deliveryAssignmentRepository.countByHubIdAndLegTypeAndStatus(
                        hubId, AssignmentLegType.LAST_MILE, AssignmentStatus.ASSIGNED))
                .inProgress(deliveryAssignmentRepository.countByHubIdAndLegTypeAndStatus(
                        hubId, AssignmentLegType.LAST_MILE, AssignmentStatus.IN_PROGRESS))
                .completedToday(deliveryAssignmentRepository.countCompletedByHubIdAndLegTypeBetween(
                        hubId, AssignmentLegType.LAST_MILE, todayStart, todayEnd))
                .build();

        return HubDashboardResponse.builder()
                .hubId(hub.getId())
                .townId(hub.getTownId())
                .hubName(hub.getName())
                .activeAgents(activeAgents)
                .orders(OrderQueueCounts.builder()
                        .readyForPickup(orderStats.readyForPickupCount())
                        .placedAwaitingDelivery(orderStats.placedOrdersCount())
                        .build())
                .pickups(pickups)
                .lastMile(lastMile)
                .activeAssignments(deliveryAssignmentRepository.countByHubIdAndStatusIn(
                        hubId, ACTIVE_ASSIGNMENT_STATUSES))
                .build();
    }

    private HubAdmin resolveActiveHubAdmin(UUID hubAdminUserId) {
        return hubAdminRepository.findByUserIdAndStatus(hubAdminUserId, HUB_ADMIN_ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "Active hub admin not found"));
    }

    private Instant startOfDay(LocalDate date) {
        return date.atStartOfDay(IST).toInstant();
    }

    private Instant exclusiveEndOfDay(LocalDate date) {
        return date.plusDays(1).atStartOfDay(IST).toInstant();
    }
}
