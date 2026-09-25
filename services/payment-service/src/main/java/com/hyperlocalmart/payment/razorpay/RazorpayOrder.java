package com.hyperlocalmart.payment.razorpay;

public record RazorpayOrder(String id, long amountPaise, String currency) {
}
