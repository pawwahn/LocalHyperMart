package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.config.PaymentProperties;
import com.hyperlocalmart.payment.dto.request.InitiatePaymentRequest;
import com.hyperlocalmart.payment.dto.request.InitiateRefundRequest;
import com.hyperlocalmart.payment.dto.response.PaymentDetailResponse;
import com.hyperlocalmart.payment.dto.response.PaymentResponse;
import com.hyperlocalmart.payment.dto.response.RefundResponse;
import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.entity.PaymentGateway;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import com.hyperlocalmart.payment.entity.PaymentWebhookLog;
import com.hyperlocalmart.payment.entity.Refund;
import com.hyperlocalmart.payment.entity.RefundStatus;
import com.hyperlocalmart.payment.repository.PaymentRepository;
import com.hyperlocalmart.payment.repository.PaymentWebhookLogRepository;
import com.hyperlocalmart.payment.repository.RefundRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentWebhookLogRepository paymentWebhookLogRepository;
    private final RefundRepository refundRepository;
    private final OrderClient orderClient;
    private final PaymentProperties paymentProperties;

    @Transactional
    public PaymentResponse initiate(UUID buyerId, InitiatePaymentRequest request, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            return paymentRepository.findByIdempotencyKey(idempotencyKey)
                    .map(this::toInitiateResponse)
                    .orElseGet(() -> createPayment(buyerId, request, idempotencyKey));
        }
        return createPayment(buyerId, request, null);
    }

    @Transactional(readOnly = true)
    public PaymentDetailResponse getPayment(UUID buyerId, UUID paymentId) {
        Payment payment = paymentRepository.findByIdAndBuyerId(paymentId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment not found"));
        return toDetail(payment);
    }

    @Transactional
    public void processWebhook(PaymentGateway gateway, Map<String, Object> payload, String headerSignature) {
        String signature = headerSignature;
        if (signature == null && payload.get("signature") != null) {
            signature = String.valueOf(payload.get("signature"));
        }
        boolean signatureValid = paymentProperties.getDevWebhookBypassSecret().equals(signature);
        PaymentWebhookLog log = PaymentWebhookLog.builder()
                .gateway(gateway.name())
                .payload(payload)
                .signatureValid(signatureValid)
                .processed(false)
                .build();
        paymentWebhookLogRepository.save(log);

        if (!signatureValid) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid webhook signature");
        }

        UUID orderId = UUID.fromString(String.valueOf(payload.get("orderId")));
        String gatewayPaymentId = payload.get("gatewayPaymentId") != null
                ? String.valueOf(payload.get("gatewayPaymentId"))
                : "gw-" + UUID.randomUUID();

        Payment payment = paymentRepository.findFirstByOrderIdAndStatusOrderByCreatedAtDesc(orderId, PaymentStatus.PENDING)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Pending payment not found for order"));

        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setGatewayPaymentId(gatewayPaymentId);
        payment.setPaidAt(Instant.now());
        paymentRepository.save(payment);

        orderClient.markPaymentSuccess(orderId, payment.getBuyerId(), payment.getId(), gateway);

        log.setProcessed(true);
        paymentWebhookLogRepository.save(log);
    }

    @Transactional
    public RefundResponse initiateRefund(UUID buyerId, InitiateRefundRequest request) {
        Payment payment = paymentRepository.findFirstByOrderIdAndStatusOrderByCreatedAtDesc(
                        request.getOrderId(), PaymentStatus.SUCCESS)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Successful payment not found for order"));

        if (!payment.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Payment does not belong to buyer");
        }

        return refundRepository.findFirstByOrderIdAndStatusInOrderByCreatedAtDesc(
                        request.getOrderId(), List.of(RefundStatus.INITIATED, RefundStatus.PROCESSING, RefundStatus.REFUNDED))
                .map(this::toRefundResponse)
                .orElseGet(() -> createRefund(payment, request));
    }

    private RefundResponse createRefund(Payment payment, InitiateRefundRequest request) {
        if (request.getAmount().compareTo(payment.getAmount()) != 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Refund amount must match payment amount");
        }

        Refund refund = Refund.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrderId())
                .amount(request.getAmount())
                .reason(request.getReason())
                .status(RefundStatus.INITIATED)
                .gatewayRefundId("rfnd_dev_" + payment.getOrderId())
                .expectedByDate(addWorkingDays(LocalDate.now(), paymentProperties.getRefundWorkingDays()))
                .build();
        return toRefundResponse(refundRepository.save(refund));
    }

    private RefundResponse toRefundResponse(Refund refund) {
        return RefundResponse.builder()
                .refundId(refund.getId())
                .paymentId(refund.getPaymentId())
                .orderId(refund.getOrderId())
                .amount(refund.getAmount())
                .status(refund.getStatus())
                .expectedByDate(refund.getExpectedByDate())
                .build();
    }

    private LocalDate addWorkingDays(LocalDate start, int workingDays) {
        LocalDate date = start;
        int added = 0;
        while (added < workingDays) {
            date = date.plusDays(1);
            if (date.getDayOfWeek().getValue() < 6) {
                added++;
            }
        }
        return date;
    }

    private PaymentResponse createPayment(UUID buyerId, InitiatePaymentRequest request, String idempotencyKey) {
        OrderClient.OrderSnapshot order = orderClient.getOrder(request.getOrderId(), buyerId);
        validateOrderForPayment(order, request.getTownId(), buyerId);

        Payment payment = Payment.builder()
                .orderId(request.getOrderId())
                .townId(request.getTownId())
                .buyerId(buyerId)
                .amount(order.totalAmount())
                .gateway(request.getGateway())
                .status(PaymentStatus.PENDING)
                .gatewayOrderId("order_" + request.getOrderId())
                .idempotencyKey(idempotencyKey)
                .build();
        return toInitiateResponse(paymentRepository.save(payment));
    }

    private void validateOrderForPayment(OrderClient.OrderSnapshot order, UUID townId, UUID buyerId) {
        if (!order.buyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Order does not belong to buyer");
        }
        if (!order.townId().equals(townId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Town mismatch");
        }
        if (!"ONLINE".equals(order.paymentMethod())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Order is not an online payment order");
        }
        if (!"PAYMENT_PENDING".equals(order.status()) && !"PAYMENT_FAILED".equals(order.status())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order is not awaiting payment");
        }
    }

    private PaymentResponse toInitiateResponse(Payment payment) {
        String upiIntent = "upi://pay?pa=hyperlocalmart@razorpay&pn=HyperLocalMart&am="
                + payment.getAmount().toPlainString()
                + "&tn=Order-" + payment.getOrderId();
        return PaymentResponse.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrderId())
                .status(payment.getStatus())
                .gateway(payment.getGateway())
                .amount(payment.getAmount())
                .upiIntent(upiIntent)
                .qrPayload("upi://pay?order=" + payment.getOrderId())
                .build();
    }

    private PaymentDetailResponse toDetail(Payment payment) {
        return PaymentDetailResponse.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrderId())
                .townId(payment.getTownId())
                .status(payment.getStatus())
                .gateway(payment.getGateway())
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .gatewayPaymentId(payment.getGatewayPaymentId())
                .paidAt(payment.getPaidAt())
                .build();
    }
}
