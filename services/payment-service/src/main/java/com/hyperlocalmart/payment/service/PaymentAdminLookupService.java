package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.dto.response.AdminOrderPaymentsResponse;
import com.hyperlocalmart.payment.dto.response.AdminPaymentAttemptResponse;
import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentAdminLookupService {

    private final OrderClient orderClient;
    private final PaymentRepository paymentRepository;

    @Transactional(readOnly = true)
    public AdminOrderPaymentsResponse lookup(String query) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Enter an order number or order id");
        }
        OrderClient.OrderSnapshot order = orderClient.resolveOrder(q);
        List<Payment> payments = paymentRepository.findByOrderIdOrderByCreatedAtDesc(order.orderId());
        return AdminOrderPaymentsResponse.builder()
                .orderId(order.orderId())
                .orderNumber(order.orderNumber())
                .townId(order.townId())
                .buyerId(order.buyerId())
                .buyerPhone(order.buyerPhone())
                .orderStatus(order.status())
                .paymentStatus(order.paymentStatus())
                .paymentMethod(order.paymentMethod())
                .orderTotal(order.totalAmount())
                .payments(payments.stream().map(this::toAttempt).toList())
                .build();
    }

    private AdminPaymentAttemptResponse toAttempt(Payment payment) {
        String orderNumber = payment.getOrderNumber();
        if (orderNumber == null || orderNumber.isBlank()) {
            orderNumber = null;
        }
        return AdminPaymentAttemptResponse.builder()
                .paymentId(payment.getId())
                .status(payment.getStatus())
                .gateway(payment.getGateway())
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .orderNumber(orderNumber)
                .gatewayOrderId(payment.getGatewayOrderId())
                .gatewayPaymentId(payment.getGatewayPaymentId())
                .createdAt(payment.getCreatedAt())
                .paidAt(payment.getPaidAt())
                .build();
    }
}
