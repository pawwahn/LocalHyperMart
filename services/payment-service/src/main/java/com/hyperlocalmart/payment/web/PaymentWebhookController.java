package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments/webhooks")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final PaymentService paymentService;

    @PostMapping("/razorpay")
    public ResponseEntity<Void> razorpayWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        paymentService.processRazorpayWebhook(rawBody, signature);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/cashfree")
    public ResponseEntity<Void> cashfreeWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "x-webhook-timestamp", required = false) String timestamp,
            @RequestHeader(value = "x-webhook-signature", required = false) String signature) {
        paymentService.processCashfreeWebhook(rawBody, timestamp, signature);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/phonepe")
    public ResponseEntity<Void> phonepeWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        paymentService.processPhonePeWebhook(rawBody, authorization);
        return ResponseEntity.ok().build();
    }
}
