package com.hyperlocalmart.order.laundry;

import java.time.Duration;
import java.time.Instant;

/**
 * Customer item photos are removed three days after delivery, and only for that line.
 * An open complaint holds the file until the complaint is closed.
 */
public final class LaundryPhotoPolicy {

    public static final Duration RETENTION = Duration.ofDays(3);

    private LaundryPhotoPolicy() {
    }

    public static boolean due(Instant deliveredAt, boolean complaintOpen, Instant photoDeletedAt, Instant now) {
        if (photoDeletedAt != null || complaintOpen || deliveredAt == null || now == null) {
            return false;
        }
        return !deliveredAt.plus(RETENTION).isAfter(now);
    }
}
