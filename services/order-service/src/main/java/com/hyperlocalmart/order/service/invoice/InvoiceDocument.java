package com.hyperlocalmart.order.service.invoice;

import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Value
@Builder
public class InvoiceDocument {

    String orderNumber;
    String townName;
    Instant placedAt;
    PaymentMethod paymentMethod;
    PaymentStatus paymentStatus;
    Map<String, Object> deliveryAddress;
    String buyerPhone;
    BigDecimal itemsSubtotal;
    BigDecimal deliveryFee;
    BigDecimal platformFee;
    BigDecimal taxAmount;
    BigDecimal totalAmount;
    List<InvoiceLineItem> lineItems;

    @Value
    @Builder
    public static class InvoiceLineItem {
        String itemName;
        String shopName;
        String unitCode;
        int quantity;
        BigDecimal unitPrice;
        BigDecimal lineTotal;
    }
}
