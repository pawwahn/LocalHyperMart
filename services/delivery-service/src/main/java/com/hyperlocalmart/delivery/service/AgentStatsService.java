package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.response.AgentStatsResponse;
import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.AssignmentStatus;
import com.hyperlocalmart.delivery.entity.DeliveryAgent;
import com.hyperlocalmart.delivery.repository.DeliveryAgentRepository;
import com.hyperlocalmart.delivery.repository.DeliveryAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentStatsService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final EnumSet<AssignmentStatus> PICKED =
            EnumSet.of(AssignmentStatus.IN_PROGRESS, AssignmentStatus.COMPLETED);
    private static final EnumSet<AssignmentStatus> OPEN =
            EnumSet.of(AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS);

    private final DeliveryAgentRepository deliveryAgentRepository;
    private final DeliveryAssignmentRepository deliveryAssignmentRepository;

    @Transactional(readOnly = true)
    public AgentStatsResponse getMyStats(UUID agentUserId) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        UUID agentId = agent.getId();
        LocalDate today = LocalDate.now(IST);
        Instant dayStart = today.atStartOfDay(IST).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(IST).toInstant();
        LocalDate weekStartDate = today.minusDays((today.getDayOfWeek().getValue() + 6) % 7);
        Instant weekStart = weekStartDate.atStartOfDay(IST).toInstant();
        Instant monthStart = today.withDayOfMonth(1).atStartOfDay(IST).toInstant();

        AgentStatsResponse.AgentPeriodStats todayStats = period(agentId, dayStart, dayEnd);
        AgentStatsResponse.AgentPeriodStats weekStats = period(agentId, weekStart, dayEnd);
        AgentStatsResponse.AgentPeriodStats monthStats = period(agentId, monthStart, dayEnd);
        AgentStatsResponse.AgentPeriodStats allTime = allTime(agentId);

        long openShop = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatusIn(
                agentId, AssignmentLegType.PICKUP, OPEN);
        long openHome = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatusIn(
                agentId, AssignmentLegType.LAST_MILE, OPEN);

        return AgentStatsResponse.builder()
                .vendorPickupsCollected(allTime.getShopPicked())
                .vendorPickupsAtHub(allTime.getDroppedAtHub())
                .buyerDeliveriesCompleted(allTime.getHomeDelivered())
                .vendorPickupsCollectedToday(todayStats.getShopPicked())
                .vendorPickupsAtHubToday(todayStats.getDroppedAtHub())
                .buyerDeliveriesCompletedToday(todayStats.getHomeDelivered())
                .openShopPickups(openShop)
                .openHomeDeliveries(openHome)
                .returnsToHub(allTime.getReturnsToHub())
                .returnsToHubToday(todayStats.getReturnsToHub())
                .today(todayStats)
                .week(weekStats)
                .month(monthStats)
                .allTime(allTime)
                .build();
    }

    private AgentStatsResponse.AgentPeriodStats period(UUID agentId, Instant start, Instant end) {
        long shopPicked = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatusInAndUpdatedAtBetween(
                agentId, AssignmentLegType.PICKUP, PICKED, start, end);
        long droppedAtHub = deliveryAssignmentRepository.countCompletedByAgentIdAndLegTypeBetween(
                agentId, AssignmentLegType.PICKUP, start, end);
        long homeDelivered = deliveryAssignmentRepository.countCompletedByAgentIdAndLegTypeBetween(
                agentId, AssignmentLegType.LAST_MILE, start, end);
        long returns = deliveryAssignmentRepository.countBuyerRejectedByAgentIdBetween(agentId, start, end);
        long cancelledPickups = deliveryAssignmentRepository.countCancelledByAgentIdAndLegTypeBetween(
                agentId, AssignmentLegType.PICKUP, start, end);
        return AgentStatsResponse.AgentPeriodStats.builder()
                .shopPicked(shopPicked)
                .droppedAtHub(droppedAtHub)
                .homeDelivered(homeDelivered)
                .returnsToHub(returns)
                .cancelledPickups(cancelledPickups)
                .build();
    }

    private AgentStatsResponse.AgentPeriodStats allTime(UUID agentId) {
        long shopPicked = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatusIn(
                agentId, AssignmentLegType.PICKUP, PICKED);
        long droppedAtHub = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatus(
                agentId, AssignmentLegType.PICKUP, AssignmentStatus.COMPLETED);
        long homeDelivered = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatus(
                agentId, AssignmentLegType.LAST_MILE, AssignmentStatus.COMPLETED);
        long returns = deliveryAssignmentRepository.countBuyerRejectedByAgentId(agentId);
        long cancelledPickups = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatus(
                agentId, AssignmentLegType.PICKUP, AssignmentStatus.CANCELLED);
        return AgentStatsResponse.AgentPeriodStats.builder()
                .shopPicked(shopPicked)
                .droppedAtHub(droppedAtHub)
                .homeDelivered(homeDelivered)
                .returnsToHub(returns)
                .cancelledPickups(cancelledPickups)
                .build();
    }
}
