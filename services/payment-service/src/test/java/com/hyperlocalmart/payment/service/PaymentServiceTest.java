package com.hyperlocalmart.payment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.config.PaymentProperties;
import com.hyperlocalmart.payment.dto.request.InitiatePaymentRequest;
import com.hyperlocalmart.payment.dto.request.InitiateRefundRequest;
import com.hyperlocalmart.payment.dto.response.PaymentResponse;
import com.hyperlocalmart.payment.entity.PaymentGateway;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import com.hyperlocalmart.payment.entity.RefundStatus;
import com.hyperlocalmart.payment.razorpay.RazorpayClient;
import com.hyperlocalmart.payment.repository.PaymentRepository;
import com.hyperlocalmart.payment.repository.PaymentWebhookLogRepository;
import com.hyperlocalmart.payment.repository.RefundRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private PaymentWebhookLogRepository paymentWebhookLogRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private OrderClient orderClient;
    @Mock private PaymentProperties paymentProperties;
    @Mock private RazorpayClient razorpayClient;
    @Mock private MembershipService membershipService;
    @Mock private ObjectMapper objectMapper;
    @Mock private TransactionTemplate transactionTemplate;
    @Mock private RazorpayGatewayQueueService razorpayGatewayQueue;
    @Mock private RazorpayGatewaySyncService razorpayGatewaySync;

    @InjectMocks
    private PaymentService paymentService;

    @BeforeEach
    void wireTransactions() {
        when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(null);
        });
        doAnswer(invocation -> {
            org.springframework.transaction.support.TransactionCallbackWithoutResult callback =
                    invocation.getArgument(0);
            callback.doInTransaction(null);
            return null;
        }).when(transactionTemplate).executeWithoutResult(any());
        when(razorpayGatewayQueue.isEnabled()).thenReturn(false);
        doAnswer(invocation -> {
            UUID paymentId = invocation.getArgument(0);
            com.hyperlocalmart.payment.entity.Payment payment = storedPayment.get();
            if (payment != null && payment.getGatewayOrderId() == null) {
                payment.setGatewayOrderId("order_test123");
            }
            return null;
        }).when(razorpayGatewaySync).ensureOrderPaymentGateway(any());
    }

    private final AtomicReference<com.hyperlocalmart.payment.entity.Payment> storedPayment = new AtomicReference<>();

    @Test
    void initiate_createsPendingPaymentWithCheckoutOrder() {
        UUID buyerId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();

        InitiatePaymentRequest request = new InitiatePaymentRequest();
        request.setOrderId(orderId);
        request.setTownId(townId);
        request.setGateway(PaymentGateway.RAZORPAY);

        when(orderClient.getOrder(orderId, buyerId)).thenReturn(new OrderClient.OrderSnapshot(
                orderId, buyerId, townId, "NRPT/2026/00001", "PAYMENT_PENDING", "PENDING", "ONLINE",
                new BigDecimal("538.00"), "9876543210"
        ));
        when(paymentRepository.findFirstByOrderIdAndStatusOrderByCreatedAtDesc(orderId, PaymentStatus.PENDING))
                .thenReturn(Optional.empty());
        when(paymentRepository.save(any())).thenAnswer(invocation -> {
            com.hyperlocalmart.payment.entity.Payment payment = invocation.getArgument(0);
            if (payment.getId() == null) {
                payment.setId(UUID.randomUUID());
            }
            storedPayment.set(payment);
            return payment;
        });
        when(paymentRepository.findById(any())).thenAnswer(invocation -> Optional.ofNullable(storedPayment.get()));
        when(paymentProperties.isRazorpayConfigured()).thenReturn(false);

        PaymentResponse response = paymentService.initiate(buyerId, request, "idem-1");

        assertThat(response.getStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(response.getUpiIntent()).contains("upi://pay");
        assertThat(response.getAmount()).isEqualByComparingTo("538.00");
        assertThat(response.getCheckout()).isNotNull();
        assertThat(response.getCheckout().getGatewayOrderId()).isEqualTo("order_test123");
        assertThat(response.getCheckout().getAmountPaise()).isEqualTo(53800L);
    }

    @Test
    void initiate_returnsCachedIdempotentResponse() {
        UUID buyerId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();
        com.hyperlocalmart.payment.entity.Payment existing = com.hyperlocalmart.payment.entity.Payment.builder()
                .id(paymentId)
                .orderId(orderId)
                .townId(townId)
                .buyerId(buyerId)
                .amount(new BigDecimal("100"))
                .gateway(PaymentGateway.RAZORPAY)
                .status(PaymentStatus.PENDING)
                .build();
        when(paymentRepository.findByIdempotencyKey("idem-2")).thenReturn(Optional.of(existing));
        when(paymentRepository.findById(paymentId)).thenReturn(Optional.of(existing));
        when(orderClient.getOrder(orderId, buyerId)).thenReturn(new OrderClient.OrderSnapshot(
                orderId, buyerId, townId, "NRPT/2026/00002", "PAYMENT_PENDING", "PENDING", "ONLINE",
                new BigDecimal("100"), "9876543210"));

        InitiatePaymentRequest request = new InitiatePaymentRequest();
        request.setOrderId(orderId);
        request.setTownId(townId);
        request.setGateway(PaymentGateway.RAZORPAY);

        PaymentResponse response = paymentService.initiate(buyerId, request, "idem-2");
        assertThat(response.getPaymentId()).isEqualTo(paymentId);
    }

    @Test
    void initiateRefund_createsRefundForSuccessfulPayment() {
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

        when(paymentRepository.findFirstByOrderIdAndStatusOrderByCreatedAtDesc(orderId, PaymentStatus.SUCCESS))
                .thenReturn(Optional.of(payment));
        when(refundRepository.findFirstByOrderIdAndStatusInOrderByCreatedAtDesc(any(), any()))
                .thenReturn(Optional.empty());
        when(refundRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        InitiateRefundRequest refundRequest = new InitiateRefundRequest();
        refundRequest.setOrderId(orderId);
        refundRequest.setReason("Buyer cancelled");

        var response = paymentService.initiateRefund(buyerId, refundRequest);
        assertThat(response.getStatus()).isEqualTo(RefundStatus.REFUNDED);
    }
}
