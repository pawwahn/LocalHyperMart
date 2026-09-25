package com.hyperlocalmart.payment.razorpay;

public record RazorpayPayment(String id, String orderId, String status, long amountPaise) {

    public boolean isSuccessful() {
        return "captured".equalsIgnoreCase(status) || "authorized".equalsIgnoreCase(status);
    }

    public boolean isFailed() {
        return "failed".equalsIgnoreCase(status);
    }
}
