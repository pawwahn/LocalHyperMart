package com.hyperlocalmart.order.beauty;

public enum BeautyOrderStatus {
    AWAITING_PAYMENT("Waiting for payment"),
    CONFIRMED("Confirmed"),
    EN_ROUTE("Artist on the way"),
    IN_SERVICE("In session"),
    COMPLETED("Completed"),
    CANCELLED("Cancelled");

    private final String label;

    BeautyOrderStatus(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
