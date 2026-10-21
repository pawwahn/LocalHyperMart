package com.hyperlocalmart.order.laundry;

public enum LaundryOrderStatus {
    AWAITING_PAYMENT,
    REQUESTED,
    ACCEPTED,
    PICKUP_SCHEDULED,
    PICKED_UP,
    AT_SHOP,
    IN_PROCESS,
    READY,
    OUT_FOR_DROP,
    DELIVERED,
    CANCELLED;

    public String label() {
        return switch (this) {
            case AWAITING_PAYMENT -> "Awaiting payment";
            case REQUESTED -> "Request sent";
            case ACCEPTED -> "Shop accepted";
            case PICKUP_SCHEDULED -> "Pickup scheduled";
            case PICKED_UP -> "Picked up";
            case AT_SHOP -> "At the shop";
            case IN_PROCESS -> "In process";
            case READY -> "Ready";
            case OUT_FOR_DROP -> "Out for drop";
            case DELIVERED -> "Delivered";
            case CANCELLED -> "Cancelled";
        };
    }
}
