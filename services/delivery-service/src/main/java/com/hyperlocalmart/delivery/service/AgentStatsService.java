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

    private final DeliveryAgentRepository deliveryAgentRepository;
    private final DeliveryAssignmentRepository deliveryAssignmentRepository;

    @Transactional(readOnly = true)
    public AgentStatsResponse getMyStats(UUID agentUserId) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        UUID agentId = agent.getId();
        Instant dayStart = LocalDate.now(IST).atStartOfDay(IST).toInstant();
        Instant dayEnd = LocalDate.now(IST).plusDays(1).atStartOfDay(IST).toInstant();

        long vendorPickupsCollected = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatusIn(
                agentId, AssignmentLegType.PICKUP,
                EnumSet.of(AssignmentStatus.IN_PROGRESS, AssignmentStatus.COMPLETED));
        long vendorPickupsAtHub = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatus(
                agentId, AssignmentLegType.PICKUP, AssignmentStatus.COMPLETED);
        long buyerDeliveriesCompleted = deliveryAssignmentRepository.countByAgentIdAndLegTypeAndStatus(
                agentId, AssignmentLegType.LAST_MILE, AssignmentStatus.COMPLETED);

        long vendorPickupsCollectedToday = deliveryAssignmentRepository
                .countByAgentIdAndLegTypeAndStatusInAndUpdatedAtBetween(
                        agentId, AssignmentLegType.PICKUP,
                        EnumSet.of(AssignmentStatus.IN_PROGRESS, AssignmentStatus.COMPLETED),
                        dayStart, dayEnd);
        long vendorPickupsAtHubToday = deliveryAssignmentRepository
                .countCompletedByAgentIdAndLegTypeBetween(agentId, AssignmentLegType.PICKUP, dayStart, dayEnd);
        long buyerDeliveriesCompletedToday = deliveryAssignmentRepository
                .countCompletedByAgentIdAndLegTypeBetween(agentId, AssignmentLegType.LAST_MILE, dayStart, dayEnd);

        return AgentStatsResponse.builder()
                .vendorPickupsCollected(vendorPickupsCollected)
                .vendorPickupsAtHub(vendorPickupsAtHub)
                .buyerDeliveriesCompleted(buyerDeliveriesCompleted)
                .vendorPickupsCollectedToday(vendorPickupsCollectedToday)
                .vendorPickupsAtHubToday(vendorPickupsAtHubToday)
                .buyerDeliveriesCompletedToday(buyerDeliveriesCompletedToday)
                .build();
    }
}
