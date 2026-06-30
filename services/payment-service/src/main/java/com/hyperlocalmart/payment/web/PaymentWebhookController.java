package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.payment.entity.PaymentGateway;
import com.hyperlocalmart.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/payments/webhooks")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final PaymentService paymentService;

    @PostMapping("/razorpay")
    public ResponseEntity<Void> razorpayWebhook(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        paymentService.processWebhook(PaymentGateway.RAZORPAY, payload, signature);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/phonepe")
    public ResponseEntity<Void> phonepeWebhook(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "X-PhonePe-Signature", required = false) String signature) {
        paymentService.processWebhook(PaymentGateway.PHONEPE, payload, signature);
        return ResponseEntity.ok().build();
    }
}
