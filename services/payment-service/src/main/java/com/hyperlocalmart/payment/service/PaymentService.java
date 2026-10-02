package com.hyperlocalmart.payment.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.config.PaymentProperties;
import com.hyperlocalmart.payment.dto.request.ConfirmGatewayPaymentRequest;
import com.hyperlocalmart.payment.dto.request.InitiatePaymentRequest;
import com.hyperlocalmart.payment.dto.request.InitiateRefundRequest;
import com.hyperlocalmart.payment.dto.response.GatewayCheckoutResponse;
import com.hyperlocalmart.payment.dto.response.PaymentDetailResponse;
import com.hyperlocalmart.payment.dto.response.PaymentResponse;
import com.hyperlocalmart.payment.dto.response.RefundResponse;
import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.entity.PaymentGateway;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import com.hyperlocalmart.payment.entity.PaymentWebhookLog;
import com.hyperlocalmart.payment.entity.Refund;
import com.hyperlocalmart.payment.entity.RefundStatus;
import com.hyperlocalmart.payment.razorpay.RazorpayClient;
import com.hyperlocalmart.payment.razorpay.RazorpayMaps;
import com.hyperlocalmart.payment.razorpay.RazorpayMoney;
import com.hyperlocalmart.payment.razorpay.RazorpayPayment;
import com.hyperlocalmart.payment.razorpay.RazorpayRefund;
import com.hyperlocalmart.payment.razorpay.RazorpaySignatures;
import com.hyperlocalmart.payment.repository.PaymentRepository;
import com.hyperlocalmart.payment.repository.PaymentWebhookLogRepository;
import com.hyperlocalmart.payment.repository.RefundRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
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
    private final RazorpayClient razorpayClient;
    private final MembershipService membershipService;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final RazorpayGatewayQueueService razorpayGatewayQueue;
    private final RazorpayGatewaySyncService razorpayGatewaySync;

    public PaymentResponse initiate(UUID buyerId, InitiatePaymentRequest request, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            var existing = paymentRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                Payment payment = existing.get();
                if (payment.getGatewayOrderId() == null && payment.getStatus() == PaymentStatus.PENDING) {
                    ensureOrderGatewayCreated(payment.getId());
                    payment = paymentRepository.findById(payment.getId()).orElse(payment);
                }
                return buildInitiateResponse(buyerId, payment, request);
            }
        }
        return createPayment(buyerId, request, idempotencyKey);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentCheckout(UUID buyerId, UUID paymentId) {
        Payment payment = paymentRepository.findByIdAndBuyerId(paymentId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment not found"));
        if (payment.getGatewayOrderId() == null && payment.getStatus() == PaymentStatus.PENDING) {
            ensureOrderGatewayCreated(payment.getId());
            payment = paymentRepository.findById(payment.getId()).orElse(payment);
        }
        InitiatePaymentRequest stub = new InitiatePaymentRequest();
        stub.setOrderId(payment.getOrderId());
        stub.setTownId(payment.getTownId());
        return buildInitiateResponse(buyerId, payment, stub);
    }

    @Transactional(readOnly = true)
    public PaymentDetailResponse getPayment(UUID buyerId, UUID paymentId) {
        Payment payment = paymentRepository.findByIdAndBuyerId(paymentId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment not found"));
        return toDetail(payment);
    }

    @Transactional
    public PaymentResponse confirmCheckout(UUID buyerId, ConfirmGatewayPaymentRequest request) {
        RazorpaySignatures.verifyPayment(
                request.getRazorpayOrderId(),
                request.getRazorpayPaymentId(),
                request.getRazorpaySignature(),
                paymentProperties.getRazorpayKeySecret());
        Payment payment = paymentRepository.findByGatewayOrderId(request.getRazorpayOrderId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment not found for Razorpay order"));
        if (!payment.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Payment does not belong to buyer");
        }
        assertGatewayPaymentOk(request.getRazorpayPaymentId(), request.getRazorpayOrderId());
        markSuccess(payment, request.getRazorpayPaymentId());
        return toInitiateResponse(payment);
    }

    @Transactional
    public void processRazorpayWebhook(String rawBody, String headerSignature) {
        Map<String, Object> payload = parseJson(rawBody);
        boolean signatureValid = verifyRazorpayWebhook(rawBody, headerSignature, payload);
        PaymentWebhookLog log = PaymentWebhookLog.builder()
                .gateway(PaymentGateway.RAZORPAY.name())
                .payload(payload)
                .signatureValid(signatureValid)
                .processed(false)
                .build();
        paymentWebhookLogRepository.save(log);
        if (!signatureValid) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid webhook signature");
        }

        if (payload.get("orderId") != null && payload.get("event") == null) {
            captureStubPayload(payload);
            log.setProcessed(true);
            paymentWebhookLogRepository.save(log);
            return;
        }

        String event = String.valueOf(payload.getOrDefault("event", ""));
        String gatewayOrderId = firstNonBlank(
                RazorpayMaps.nestedString(payload, "payload", "payment", "entity", "order_id"),
                RazorpayMaps.nestedString(payload, "payload", "order", "entity", "id"));
        String gatewayPaymentId = RazorpayMaps.nestedString(payload, "payload", "payment", "entity", "id");
        if (gatewayPaymentId == null) {
            gatewayPaymentId = RazorpayMaps.nestedString(payload, "payload", "refund", "entity", "payment_id");
        }

        switch (event) {
            case "payment.captured", "order.paid", "payment.authorized" -> {
                if (membershipService.completeOnlineFromGateway(gatewayOrderId, gatewayPaymentId)) {
                    break;
                }
                Payment payment = findPendingOrAny(gatewayOrderId);
                if (payment != null) {
                    markSuccess(payment, gatewayPaymentId);
                }
            }
            case "payment.failed" -> {
                Payment payment = findPendingOrAny(gatewayOrderId);
                if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
                    markFailed(payment, "Razorpay payment failed");
                }
            }
            case "refund.processed" -> {
                String gatewayRefundId = RazorpayMaps.nestedString(payload, "payload", "refund", "entity", "id");
                markRefundProcessed(gatewayRefundId, gatewayPaymentId);
            }
            default -> {
                // Ignore unused events so Razorpay does not retry.
            }
        }
        log.setProcessed(true);
        paymentWebhookLogRepository.save(log);
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
        captureStubPayload(payload);
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
        BigDecimal amount = payment.getAmount();
        long paise = RazorpayMoney.toPaise(amount);
        RazorpayRefund gatewayRefund;
        if (payment.getGateway() == PaymentGateway.RAZORPAY && payment.getGatewayPaymentId() != null) {
            gatewayRefund = razorpayClient.refund(payment.getGatewayPaymentId(), paise, request.getReason());
        } else {
            gatewayRefund = new RazorpayRefund("rfnd_dev_" + payment.getOrderId(), "processed", paise);
        }

        RefundStatus status = gatewayRefund.isProcessed() ? RefundStatus.REFUNDED : RefundStatus.PROCESSING;
        Refund refund = Refund.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrderId())
                .amount(amount)
                .reason(request.getReason())
                .status(status)
                .gatewayRefundId(gatewayRefund.id())
                .expectedByDate(addWorkingDays(LocalDate.now(), paymentProperties.getRefundWorkingDays()))
                .refundedAt(status == RefundStatus.REFUNDED ? Instant.now() : null)
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
        OrderClient.OrderSnapshot order = resolveOrder(buyerId, request);

        UUID paymentId = transactionTemplate.execute(status -> {
            validateOrderForPayment(order, request.getTownId(), buyerId);
            Payment existingPending = paymentRepository
                    .findFirstByOrderIdAndStatusOrderByCreatedAtDesc(request.getOrderId(), PaymentStatus.PENDING)
                    .orElse(null);
            if (existingPending != null) {
                return existingPending.getId();
            }
            Payment payment = Payment.builder()
                    .orderId(request.getOrderId())
                    .townId(request.getTownId())
                    .buyerId(buyerId)
                    .amount(order.totalAmount())
                    .gateway(request.getGateway())
                    .status(PaymentStatus.PENDING)
                    .idempotencyKey(idempotencyKey)
                    .build();
            return paymentRepository.save(payment).getId();
        });

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Payment row missing"));
        if (payment.getGatewayOrderId() == null) {
            ensureOrderGatewayCreated(payment.getId());
            payment = paymentRepository.findById(paymentId).orElse(payment);
        }
        return buildInitiateResponse(buyerId, payment, request);
    }

    private void ensureOrderGatewayCreated(UUID paymentId) {
        if (useAsyncGateway()) {
            razorpayGatewayQueue.enqueueOrderPayment(
                    paymentId, () -> razorpayGatewaySync.ensureOrderPaymentGateway(paymentId));
        } else {
            razorpayGatewaySync.ensureOrderPaymentGateway(paymentId);
        }
    }

    private boolean useAsyncGateway() {
        return razorpayGatewayQueue.isEnabled() && paymentProperties.isRazorpayConfigured();
    }

    private PaymentResponse buildInitiateResponse(
            UUID buyerId, Payment payment, InitiatePaymentRequest request) {
        OrderClient.OrderSnapshot order = resolveOrder(buyerId, request);
        return toInitiateResponse(payment, contactPhone(request, order), order.orderNumber());
    }

    private OrderClient.OrderSnapshot resolveOrder(UUID buyerId, InitiatePaymentRequest request) {
        if (request.getAmount() != null
                && request.getOrderStatus() != null
                && !request.getOrderStatus().isBlank()
                && request.getPaymentMethod() != null
                && !request.getPaymentMethod().isBlank()) {
            return new OrderClient.OrderSnapshot(
                    request.getOrderId(),
                    buyerId,
                    request.getTownId(),
                    request.getOrderNumber(),
                    request.getOrderStatus(),
                    "PENDING",
                    request.getPaymentMethod(),
                    request.getAmount(),
                    request.getBuyerPhone());
        }
        return orderClient.getOrder(request.getOrderId(), buyerId);
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
        return toInitiateResponse(payment, null, null);
    }

    private PaymentResponse toInitiateResponse(Payment payment, String prefillContact) {
        return toInitiateResponse(payment, prefillContact, null);
    }

    private PaymentResponse toInitiateResponse(Payment payment, String prefillContact, String orderNumber) {
        boolean live = paymentProperties.isRazorpayConfigured();
        String upiIntent = live ? null : "upi://pay?pa=hyperlocalmart@razorpay&pn=KoYaKart&am="
                + payment.getAmount().toPlainString()
                + "&tn=Order-" + payment.getOrderId();
        String qrPayload = live ? null : "upi://pay?order=" + payment.getOrderId();
        return PaymentResponse.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrderId())
                .status(payment.getStatus())
                .gateway(payment.getGateway())
                .amount(payment.getAmount())
                .upiIntent(upiIntent)
                .qrPayload(qrPayload)
                .checkout(checkoutFor(payment, prefillContact, orderNumber))
                .build();
    }

    private GatewayCheckoutResponse checkoutFor(Payment payment, String prefillContact, String orderNumber) {
        if (payment.getGatewayOrderId() == null) {
            return null;
        }
        return GatewayCheckoutResponse.builder()
                .keyId(paymentProperties.isRazorpayConfigured() ? paymentProperties.getRazorpayKeyId() : null)
                .gatewayOrderId(payment.getGatewayOrderId())
                .amountPaise(RazorpayMoney.toPaise(payment.getAmount()))
                .currency(payment.getCurrency() == null ? "INR" : payment.getCurrency())
                .name(paymentProperties.getCheckoutName())
                .description("Order " + (orderNumber == null || orderNumber.isBlank() ? payment.getOrderId() : orderNumber))
                .prefillContact(prefillContact)
                .logoUrl(blankToNull(paymentProperties.getCheckoutLogoUrl()))
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

    private void markSuccess(Payment payment, String gatewayPaymentId) {
        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            return;
        }
        payment.setStatus(PaymentStatus.SUCCESS);
        if (gatewayPaymentId != null && !gatewayPaymentId.isBlank()) {
            payment.setGatewayPaymentId(gatewayPaymentId);
        }
        payment.setPaidAt(Instant.now());
        paymentRepository.save(payment);
        orderClient.markPaymentSuccess(payment.getOrderId(), payment.getBuyerId(), payment.getId(), payment.getGateway());
    }

    private void markFailed(Payment payment, String reason) {
        payment.setStatus(PaymentStatus.FAILED);
        paymentRepository.save(payment);
        orderClient.markPaymentFailed(payment.getOrderId(), payment.getBuyerId(), payment.getId(), reason);
    }

    private void captureStubPayload(Map<String, Object> payload) {
        UUID orderId = UUID.fromString(String.valueOf(payload.get("orderId")));
        String gatewayPaymentId = payload.get("gatewayPaymentId") != null
                ? String.valueOf(payload.get("gatewayPaymentId"))
                : "gw-" + UUID.randomUUID();
        Payment payment = paymentRepository.findFirstByOrderIdAndStatusOrderByCreatedAtDesc(orderId, PaymentStatus.PENDING)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Pending payment not found for order"));
        markSuccess(payment, gatewayPaymentId);
    }

    private boolean verifyRazorpayWebhook(String rawBody, String headerSignature, Map<String, Object> payload) {
        if (paymentProperties.isWebhookConfigured()) {
            return RazorpaySignatures.verifyWebhook(rawBody, headerSignature, paymentProperties.getRazorpayWebhookSecret());
        }
        if (paymentProperties.isRazorpayConfigured()) {
            return false;
        }
        String signature = headerSignature;
        if (signature == null && payload.get("signature") != null) {
            signature = String.valueOf(payload.get("signature"));
        }
        return paymentProperties.getDevWebhookBypassSecret().equals(signature);
    }

    private void assertGatewayPaymentOk(String gatewayPaymentId, String expectedOrderId) {
        if (!paymentProperties.isRazorpayConfigured()) {
            return;
        }
        RazorpayPayment fetched = razorpayClient.fetchPayment(gatewayPaymentId);
        if (fetched.orderId() != null && !fetched.orderId().equals(expectedOrderId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Razorpay payment does not match order");
        }
        if (fetched.isFailed()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Razorpay payment failed");
        }
        if (!fetched.isSuccessful()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Razorpay payment is not captured yet");
        }
    }

    private Payment findPendingOrAny(String gatewayOrderId) {
        if (gatewayOrderId == null || gatewayOrderId.isBlank()) {
            return null;
        }
        return paymentRepository.findByGatewayOrderId(gatewayOrderId).orElse(null);
    }

    private void markRefundProcessed(String gatewayRefundId, String gatewayPaymentId) {
        Refund refund = null;
        if (gatewayRefundId != null && !gatewayRefundId.isBlank()) {
            refund = refundRepository.findByGatewayRefundId(gatewayRefundId).orElse(null);
        }
        if (refund == null && gatewayPaymentId != null && !gatewayPaymentId.isBlank()) {
            Payment payment = paymentRepository.findFirstByGatewayPaymentId(gatewayPaymentId).orElse(null);
            if (payment != null) {
                refund = refundRepository.findFirstByOrderIdAndStatusInOrderByCreatedAtDesc(
                        payment.getOrderId(), List.of(RefundStatus.INITIATED, RefundStatus.PROCESSING))
                        .orElse(null);
            }
        }
        if (refund == null || refund.getStatus() == RefundStatus.REFUNDED) {
            return;
        }
        refund.setStatus(RefundStatus.REFUNDED);
        refund.setRefundedAt(Instant.now());
        refundRepository.save(refund);
    }

    private Map<String, Object> parseJson(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Empty webhook body");
        }
        try {
            return objectMapper.readValue(rawBody, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid webhook JSON");
        }
    }

    private static String contactPhone(InitiatePaymentRequest request, OrderClient.OrderSnapshot order) {
        if (request.getBuyerPhone() != null && !request.getBuyerPhone().isBlank()) {
            return request.getBuyerPhone();
        }
        return order.buyerPhone();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank() && !"null".equals(value)) {
                return value;
            }
        }
        return null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
