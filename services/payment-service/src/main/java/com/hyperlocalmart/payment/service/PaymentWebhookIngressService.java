package com.hyperlocalmart.payment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentWebhookIngressService {

    private final PaymentWebhookQueueService webhookQueue;
    private final PaymentService paymentService;

    public void razorpay(String rawBody, String signature) {
        if (!webhookQueue.isEnabled()) {
            paymentService.processRazorpayWebhook(rawBody, signature);
            return;
        }
        UUID logId = paymentService.acceptRazorpayWebhook(rawBody, signature);
        webhookQueue.enqueueRazorpay(logId, rawBody);
    }

    public void cashfree(String rawBody, String timestamp, String signature) {
        if (!webhookQueue.isEnabled()) {
            paymentService.processCashfreeWebhook(rawBody, timestamp, signature);
            return;
        }
        UUID logId = paymentService.acceptCashfreeWebhook(rawBody, timestamp, signature);
        webhookQueue.enqueueCashfree(logId, rawBody, timestamp, signature);
    }

    public void phonePe(String rawBody, String authorization) {
        if (!webhookQueue.isEnabled()) {
            paymentService.processPhonePeWebhook(rawBody, authorization);
            return;
        }
        UUID logId = paymentService.acceptPhonePeWebhook(rawBody, authorization);
        webhookQueue.enqueuePhonePe(logId, rawBody, authorization);
    }
}
