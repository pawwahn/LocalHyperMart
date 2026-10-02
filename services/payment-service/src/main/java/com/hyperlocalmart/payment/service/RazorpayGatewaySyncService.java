package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.entity.BuyerMembershipPurchase;
import com.hyperlocalmart.payment.entity.MembershipPurchaseStatus;
import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import com.hyperlocalmart.payment.razorpay.RazorpayClient;
import com.hyperlocalmart.payment.razorpay.RazorpayMoney;
import com.hyperlocalmart.payment.razorpay.RazorpayOrder;
import com.hyperlocalmart.payment.repository.BuyerMembershipPurchaseRepository;
import com.hyperlocalmart.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RazorpayGatewaySyncService {

    private final PaymentRepository paymentRepository;
    private final BuyerMembershipPurchaseRepository purchaseRepository;
    private final RazorpayClient razorpayClient;
    private final OrderClient orderClient;
    private final TransactionTemplate transactionTemplate;

    public void ensureOrderPaymentGateway(UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId).orElse(null);
        if (payment == null || payment.getStatus() != PaymentStatus.PENDING) {
            return;
        }
        if (payment.getGatewayOrderId() != null && !payment.getGatewayOrderId().isBlank()) {
            return;
        }
        OrderClient.OrderSnapshot order = orderClient.getOrder(payment.getOrderId(), payment.getBuyerId());
        RazorpayOrder rzp = createRazorpayOrder(payment, order.totalAmount());
        transactionTemplate.executeWithoutResult(status -> {
            Payment row = paymentRepository.findById(paymentId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Payment row missing"));
            if (row.getGatewayOrderId() != null && !row.getGatewayOrderId().isBlank()) {
                return;
            }
            row.setGatewayOrderId(rzp.id());
            paymentRepository.save(row);
        });
    }

    public void ensureMembershipGateway(UUID purchaseId) {
        BuyerMembershipPurchase purchase = purchaseRepository.findById(purchaseId).orElse(null);
        if (purchase == null || purchase.getStatus() != MembershipPurchaseStatus.PENDING_PAYMENT) {
            return;
        }
        if (purchase.getGatewayOrderId() != null && !purchase.getGatewayOrderId().isBlank()) {
            return;
        }
        long paise = RazorpayMoney.toPaise(purchase.getPriceSnapshot());
        Map<String, String> notes = new LinkedHashMap<>();
        notes.put("hlm_kind", "MEMBERSHIP");
        notes.put("hlm_purchase_id", purchase.getId().toString());
        RazorpayOrder rzp = razorpayClient.createOrder(
                paise, purchase.getId().toString().replace("-", ""), notes);
        transactionTemplate.executeWithoutResult(status -> {
            BuyerMembershipPurchase row = purchaseRepository.findById(purchaseId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Membership purchase missing"));
            if (row.getGatewayOrderId() != null && !row.getGatewayOrderId().isBlank()) {
                return;
            }
            row.setGatewayOrderId(rzp.id());
            purchaseRepository.save(row);
        });
    }

    private RazorpayOrder createRazorpayOrder(Payment payment, java.math.BigDecimal amount) {
        long paise = RazorpayMoney.toPaise(amount);
        Map<String, String> notes = new LinkedHashMap<>();
        notes.put("hlm_kind", "ORDER");
        notes.put("hlm_order_id", payment.getOrderId().toString());
        notes.put("hlm_payment_id", payment.getId().toString());
        return razorpayClient.createOrder(paise, payment.getId().toString().replace("-", ""), notes);
    }
}
