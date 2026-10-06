package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.AssignmentStatus;
import com.hyperlocalmart.delivery.entity.DeliveryAssignment;
import com.hyperlocalmart.delivery.entity.DeliveryHub;
import com.hyperlocalmart.delivery.repository.DeliveryAssignmentRepository;
import com.hyperlocalmart.delivery.repository.DeliveryHubRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeliveryPayoutLegService {

    private final DeliveryAssignmentRepository deliveryAssignmentRepository;
    private final DeliveryHubRepository deliveryHubRepository;

    /** Order IDs where this agent completed last-mile or vendor-direct delivery in the window. */
    @Transactional(readOnly = true)
    public List<UUID> completedDeliveryOrderIds(UUID agentId, Instant start, Instant end) {
        if (agentId == null || start == null || end == null || !end.isAfter(start)) {
            return List.of();
        }
        return deliveryAssignmentRepository.findDistinctCompletedDeliveryOrderIdsByAgentAndCompletedAtBetween(
                agentId, start, end);
    }

    @Transactional(readOnly = true)
    public List<OrderLegs> resolve(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = List.copyOf(orderIds);
        Map<UUID, DeliveryAssignment> lastMiles = latestCompleted(ids, AssignmentLegType.LAST_MILE);
        Map<UUID, DeliveryAssignment> pickups = latestCompleted(ids, AssignmentLegType.PICKUP);
        Map<UUID, DeliveryAssignment> vendorDirect = latestCompleted(ids, AssignmentLegType.VENDOR_DIRECT);
        Map<UUID, UUID> hubByTown = new HashMap<>();
        List<OrderLegs> out = new ArrayList<>();
        for (UUID orderId : ids) {
            DeliveryAssignment vendorTrip = vendorDirect.get(orderId);
            if (vendorTrip != null) {
                UUID hubId = hubByTown.computeIfAbsent(
                        vendorTrip.getTownId(), this::resolveTownHubId);
                out.add(new OrderLegs(
                        orderId,
                        hubId,
                        vendorTrip.getAgentId(),
                        false,
                        null,
                        false,
                        null,
                        true,
                        vendorTrip.getCompletedAt()));
                continue;
            }
            DeliveryAssignment last = lastMiles.get(orderId);
            DeliveryAssignment pick = pickups.get(orderId);
            out.add(new OrderLegs(
                    orderId,
                    last != null ? last.getHubId() : pick != null ? pick.getHubId() : null,
                    last != null ? last.getAgentId() : null,
                    last != null,
                    last != null ? last.getCompletedAt() : null,
                    pick != null,
                    pick != null ? pick.getCompletedAt() : null,
                    false,
                    null));
        }
        return out;
    }

    private UUID resolveTownHubId(UUID townId) {
        if (townId == null) {
            return null;
        }
        return deliveryHubRepository.findByTownId(townId).map(DeliveryHub::getId).orElse(null);
    }

    private Map<UUID, DeliveryAssignment> latestCompleted(List<UUID> orderIds, AssignmentLegType leg) {
        List<DeliveryAssignment> rows = deliveryAssignmentRepository.findByOrderIdInAndLegTypeAndStatus(
                orderIds, leg, AssignmentStatus.COMPLETED);
        Map<UUID, DeliveryAssignment> latest = new HashMap<>();
        for (DeliveryAssignment row : rows) {
            latest.merge(row.getOrderId(), row, (a, b) -> {
                Instant at = a.getCompletedAt() == null ? Instant.EPOCH : a.getCompletedAt();
                Instant bt = b.getCompletedAt() == null ? Instant.EPOCH : b.getCompletedAt();
                return bt.isAfter(at) ? b : a;
            });
        }
        return latest;
    }

    public record OrderLegs(
            UUID orderId,
            UUID hubId,
            UUID agentId,
            boolean lastMileCompleted,
            Instant lastMileCompletedAt,
            boolean pickupCompleted,
            Instant pickupCompletedAt,
            boolean vendorDirectCompleted,
            Instant vendorDirectCompletedAt
    ) {
    }
}
