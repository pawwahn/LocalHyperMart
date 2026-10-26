package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.payment.service.PaymentWebhookIngressService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments/webhooks")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final PaymentWebhookIngressService webhookIngress;

    @PostMapping("/razorpay")
    public ResponseEntity<Void> razorpayWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        webhookIngress.razorpay(rawBody, signature);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/cashfree")
    public ResponseEntity<Void> cashfreeWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "x-webhook-timestamp", required = false) String timestamp,
            @RequestHeader(value = "x-webhook-signature", required = false) String signature) {
        webhookIngress.cashfree(rawBody, timestamp, signature);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/phonepe")
    public ResponseEntity<Void> phonepeWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        webhookIngress.phonePe(rawBody, authorization);
        return ResponseEntity.ok().build();
    }
}
