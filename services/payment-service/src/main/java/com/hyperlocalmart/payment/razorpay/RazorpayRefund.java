package com.hyperlocalmart.payment.razorpay;

public record RazorpayRefund(String id, String status, long amountPaise) {

    public boolean isProcessed() {
        return "processed".equalsIgnoreCase(status);
    }
}
