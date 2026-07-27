package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.config.PaymentProperties;
import com.hyperlocalmart.payment.dto.request.InitiatePaymentRequest;
import com.hyperlocalmart.payment.dto.request.InitiateRefundRequest;
import com.hyperlocalmart.payment.dto.response.PaymentResponse;
import com.hyperlocalmart.payment.entity.PaymentGateway;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import com.hyperlocalmart.payment.entity.RefundStatus;
import com.hyperlocalmart.payment.repository.PaymentRepository;
import com.hyperlocalmart.payment.repository.PaymentWebhookLogRepository;
import com.hyperlocalmart.payment.repository.RefundRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private PaymentWebhookLogRepository paymentWebhookLogRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private OrderClient orderClient;
    @Mock private PaymentProperties paymentProperties;

    @InjectMocks
    private PaymentService paymentService;

    @Test
    void initiate_createsPendingPaymentWithUpiIntent() {
        UUID buyerId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();

        InitiatePaymentRequest request = new InitiatePaymentRequest();
        request.setOrderId(orderId);
        request.setTownId(townId);
        request.setGateway(PaymentGateway.RAZORPAY);

        when(orderClient.getOrder(orderId, buyerId)).thenReturn(new OrderClient.OrderSnapshot(
                orderId, buyerId, townId, "NRPT/2026/00001", "PAYMENT_PENDING", "PENDING", "ONLINE",
                new BigDecimal("538.00")
        ));
        when(paymentRepository.save(any())).thenAnswer(invocation -> {
            com.hyperlocalmart.payment.entity.Payment payment = invocation.getArgument(0);
            payment.setId(UUID.randomUUID());
            return payment;
        });

        PaymentResponse response = paymentService.initiate(buyerId, request, "idem-1");

        assertThat(response.getStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(response.getUpiIntent()).contains("upi://pay");
        assertThat(response.getAmount()).isEqualByComparingTo("538.00");
    }

    @Test
    void initiate_returnsCachedIdempotentResponse() {
        UUID paymentId = UUID.randomUUID();
        com.hyperlocalmart.payment.entity.Payment existing = com.hyperlocalmart.payment.entity.Payment.builder()
                .id(paymentId)
                .orderId(UUID.randomUUID())
                .amount(new BigDecimal("100"))
                .gateway(PaymentGateway.RAZORPAY)
                .status(PaymentStatus.PENDING)
                .build();
        when(paymentRepository.findByIdempotencyKey("idem-2")).thenReturn(Optional.of(existing));

        InitiatePaymentRequest request = new InitiatePaymentRequest();
        request.setOrderId(UUID.randomUUID());
        request.setTownId(UUID.randomUUID());
        request.setGateway(PaymentGateway.RAZORPAY);

        PaymentResponse response = paymentService.initiate(UUID.randomUUID(), request, "idem-2");
        assertThat(response.getPaymentId()).isEqualTo(paymentId);
    }

    @Test
    void initiateRefund_createsInitiatedRefundForSuccessfulPayment() {
        UUID buyerId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();

        com.hyperlocalmart.payment.entity.Payment payment = com.hyperlocalmart.payment.entity.Payment.builder()
                .id(paymentId)
                .orderId(orderId)
                .buyerId(buyerId)
                .amount(new BigDecimal("850.00"))
                .gateway(PaymentGateway.RAZORPAY)
                .status(PaymentStatus.SUCCESS)
                .build();

        InitiateRefundRequest request = new InitiateRefundRequest();
        request.setOrderId(orderId);
        request.setAmount(new BigDecimal("850.00"));
        request.setReason("Out of stock today");

        when(paymentRepository.findFirstByOrderIdAndStatusOrderByCreatedAtDesc(orderId, PaymentStatus.SUCCESS))
                .thenReturn(Optional.of(payment));
        when(refundRepository.findFirstByOrderIdAndStatusInOrderByCreatedAtDesc(eq(orderId), any()))
                .thenReturn(Optional.empty());
        when(paymentProperties.getRefundWorkingDays()).thenReturn(5);
        when(refundRepository.save(any())).thenAnswer(invocation -> {
            com.hyperlocalmart.payment.entity.Refund refund = invocation.getArgument(0);
            refund.setId(UUID.randomUUID());
            return refund;
        });

        var response = paymentService.initiateRefund(buyerId, request);

        assertThat(response.getStatus()).isEqualTo(RefundStatus.INITIATED);
        assertThat(response.getAmount()).isEqualByComparingTo("850.00");
        assertThat(response.getExpectedByDate()).isNotNull();
    }
}
