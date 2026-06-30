package com.hyperlocalmart.order.service.invoice;

import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class InvoicePdfServiceTest {

    private final InvoicePdfService invoicePdfService = new InvoicePdfService();

    @Test
    void generate_producesValidPdfWithOrderNumber() {
        InvoiceDocument document = InvoiceDocument.builder()
                .orderNumber("NRPT-00001")
                .townName("Narsaraopet")
                .placedAt(Instant.parse("2026-06-26T10:00:00Z"))
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PAID)
                .deliveryAddress(Map.of(
                        "recipientName", "Pavan Kumar",
                        "recipientPhone", "9876543210",
                        "line1", "MG Road",
                        "pincode", "522601"))
                .buyerPhone("9876543210")
                .itemsSubtotal(new BigDecimal("498.00"))
                .deliveryFee(new BigDecimal("40.00"))
                .platformFee(BigDecimal.ZERO)
                .taxAmount(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("538.00"))
                .lineItems(List.of(
                        InvoiceDocument.InvoiceLineItem.builder()
                                .itemName("Tomato")
                                .shopName("Ravi Kirana")
                                .quantity(2)
                                .unitPrice(new BigDecimal("30.00"))
                                .lineTotal(new BigDecimal("60.00"))
                                .build()))
                .build();

        byte[] pdf = invoicePdfService.generate(document);

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
    }
}
