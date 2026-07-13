package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.DeliveryAssignment;
import com.hyperlocalmart.delivery.repository.DeliveryAssignmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class AssignmentNumberBackfill {

    private final DeliveryAssignmentRepository deliveryAssignmentRepository;
    private final OrderClient orderClient;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void backfillMissingNumbers() {
        List<DeliveryAssignment> missing = deliveryAssignmentRepository.findByAssignmentNumberIsNull();
        if (missing.isEmpty()) {
            return;
        }

        log.info("Backfilling assignment numbers for {} existing assignment(s)", missing.size());
        for (DeliveryAssignment assignment : missing) {
            try {
                if (assignment.getLegType() == AssignmentLegType.PICKUP && assignment.getVendorSubOrderId() != null) {
                    OrderClient.SubOrderSnapshot subOrder = orderClient.getSubOrder(assignment.getVendorSubOrderId());
                    assignment.setOrderNumber(subOrder.orderNumber());
                    assignment.setSubOrderNumber(subOrder.subOrderNumber());
                    assignment.setAssignmentNumber(AssignmentNumberFormatter.pickup(subOrder.subOrderNumber()));
                } else {
                    OrderClient.DeliveryOrderSnapshot order = orderClient.getDeliveryOrder(assignment.getOrderId());
                    assignment.setOrderNumber(order.orderNumber());
                    assignment.setAssignmentNumber(AssignmentNumberFormatter.lastMile(order.orderNumber()));
                }
                deliveryAssignmentRepository.save(assignment);
            } catch (Exception ex) {
                log.warn("Could not backfill assignment {}: {}", assignment.getId(), ex.getMessage());
            }
        }
    }
}
