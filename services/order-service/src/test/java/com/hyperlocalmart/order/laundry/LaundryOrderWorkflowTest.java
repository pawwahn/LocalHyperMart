package com.hyperlocalmart.order.laundry;

import com.hyperlocalmart.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LaundryOrderWorkflowTest {

    @Test
    void pickupAndDropReachesDeliveryAndAllowsOneReschedule() {
        LaundryOrderStatus status = LaundryOrderStatus.REQUESTED;
        status = LaundryOrderWorkflow.next(LaundryLogistics.PICKUP_AND_DROP, status, LaundryMove.ACCEPT, 0, false);
        status = LaundryOrderWorkflow.next(LaundryLogistics.PICKUP_AND_DROP, status, LaundryMove.SCHEDULE_PICKUP, 0, false);
        assertEquals(LaundryOrderStatus.PICKUP_SCHEDULED, status);
        status = LaundryOrderWorkflow.next(LaundryLogistics.PICKUP_AND_DROP, status, LaundryMove.SCHEDULE_PICKUP, 0, false);
        assertEquals(LaundryOrderStatus.PICKUP_SCHEDULED, status);
        assertThrows(BusinessException.class, () -> LaundryOrderWorkflow.next(
                LaundryLogistics.PICKUP_AND_DROP, LaundryOrderStatus.PICKUP_SCHEDULED, LaundryMove.SCHEDULE_PICKUP, 1, false));
        status = LaundryOrderWorkflow.next(LaundryLogistics.PICKUP_AND_DROP, status, LaundryMove.MARK_PICKED_UP, 1, false);
        status = LaundryOrderWorkflow.next(LaundryLogistics.PICKUP_AND_DROP, status, LaundryMove.START, 1, false);
        status = LaundryOrderWorkflow.next(LaundryLogistics.PICKUP_AND_DROP, status, LaundryMove.MARK_READY, 1, false);
        status = LaundryOrderWorkflow.next(LaundryLogistics.PICKUP_AND_DROP, status, LaundryMove.OUT_FOR_DROP, 1, false);
        status = LaundryOrderWorkflow.next(LaundryLogistics.PICKUP_AND_DROP, status, LaundryMove.DELIVER, 1, false);
        assertEquals(LaundryOrderStatus.DELIVERED, status);
    }

    @Test
    void dropOnlySkipsPickupAndPickupOnlySkipsDrop() {
        assertThrows(BusinessException.class, () -> LaundryOrderWorkflow.next(
                LaundryLogistics.DROP_ONLY, LaundryOrderStatus.ACCEPTED, LaundryMove.SCHEDULE_PICKUP, 0, false));
        assertEquals(LaundryOrderStatus.AT_SHOP, LaundryOrderWorkflow.next(
                LaundryLogistics.DROP_ONLY, LaundryOrderStatus.ACCEPTED, LaundryMove.MARK_RECEIVED, 0, false));
        assertEquals(LaundryOrderStatus.DELIVERED, LaundryOrderWorkflow.next(
                LaundryLogistics.PICKUP_ONLY, LaundryOrderStatus.READY, LaundryMove.DELIVER, 0, false));
        assertThrows(BusinessException.class, () -> LaundryOrderWorkflow.next(
                LaundryLogistics.PICKUP_ONLY, LaundryOrderStatus.READY, LaundryMove.OUT_FOR_DROP, 0, false));
    }

    @Test
    void cancelStopsAfterPickupAndRewashIsOnce() {
        assertThrows(BusinessException.class, () -> LaundryOrderWorkflow.next(
                LaundryLogistics.PICKUP_AND_DROP, LaundryOrderStatus.PICKED_UP, LaundryMove.CANCEL, 0, false));
        assertEquals(LaundryOrderStatus.IN_PROCESS, LaundryOrderWorkflow.next(
                LaundryLogistics.PICKUP_AND_DROP, LaundryOrderStatus.DELIVERED, LaundryMove.REWASH, 0, false));
        assertThrows(BusinessException.class, () -> LaundryOrderWorkflow.next(
                LaundryLogistics.PICKUP_AND_DROP, LaundryOrderStatus.DELIVERED, LaundryMove.REWASH, 0, true));
    }

    @Test
    void photoPurgeWaitsThreeDaysAndSkipsOpenComplaints() {
        Instant delivered = Instant.parse("2026-10-01T10:00:00Z");
        Instant tooSoon = delivered.plus(2, ChronoUnit.DAYS);
        Instant due = delivered.plus(3, ChronoUnit.DAYS);
        assertFalse(LaundryPhotoPolicy.due(delivered, false, null, tooSoon));
        assertTrue(LaundryPhotoPolicy.due(delivered, false, null, due));
        assertFalse(LaundryPhotoPolicy.due(delivered, true, null, due));
        assertFalse(LaundryPhotoPolicy.due(delivered, false, due, due.plus(1, ChronoUnit.HOURS)));
        assertFalse(LaundryPhotoPolicy.due(null, false, null, due));
    }
}
