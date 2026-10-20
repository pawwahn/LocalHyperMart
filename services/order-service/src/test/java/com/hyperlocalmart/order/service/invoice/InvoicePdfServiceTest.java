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
    void generate_producesValidPdfWithOrderNumber() throws Exception {
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
                                .itemName("Bath Soap 100g")
                                .hsnCode("999799")
                                .quantity(2)
                                .gstPercent(new BigDecimal("18"))
                                .unitPrice(new BigDecimal("35.00"))
                                .cgstAmount(new BigDecimal("5.34"))
                                .sgstAmount(new BigDecimal("5.34"))
                                .cessAmount(BigDecimal.ZERO)
                                .lineTotal(new BigDecimal("70.00"))
                                .build(),
                        InvoiceDocument.InvoiceLineItem.builder()
                                .itemName("Choco Cereal 500g")
                                .hsnCode("999799")
                                .quantity(1)
                                .gstPercent(new BigDecimal("18"))
                                .unitPrice(new BigDecimal("200.00"))
                                .cgstAmount(new BigDecimal("15.26"))
                                .sgstAmount(new BigDecimal("15.25"))
                                .cessAmount(BigDecimal.ZERO)
                                .lineTotal(new BigDecimal("200.00"))
                                .build(),
                        InvoiceDocument.InvoiceLineItem.builder()
                                .itemName("Premium Ghee 1L")
                                .hsnCode("0405")
                                .quantity(1)
                                .gstPercent(new BigDecimal("12"))
                                .unitPrice(new BigDecimal("1234.56"))
                                .cgstAmount(new BigDecimal("66.14"))
                                .sgstAmount(new BigDecimal("66.14"))
                                .cessAmount(new BigDecimal("12.35"))
                                .lineTotal(new BigDecimal("1234.56"))
                                .build()))
                .build();

        byte[] pdf = invoicePdfService.generate(document);

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
        java.nio.file.Path out = java.nio.file.Path.of(System.getProperty("java.io.tmpdir"), "koyakart-invoice-sample.pdf");
        java.nio.file.Files.write(out, pdf);

        com.lowagie.text.pdf.PdfReader reader = new com.lowagie.text.pdf.PdfReader(pdf);
        String text = new com.lowagie.text.pdf.parser.PdfTextExtractor(reader).getTextFromPage(1);
        reader.close();
        assertThat(text).contains("All amounts in Rs.");
        assertThat(text).contains("1,234.56");
        assertThat(text).contains("35.00");
        assertThat(text).contains("Cess");
        assertThat(text).contains("12.35");
        assertThat(text).doesNotContain("Rs. 35.00");
    }

    @Test
    void generate_omitsCessColumnWhenEveryLineIsZero() throws Exception {
        InvoiceDocument document = InvoiceDocument.builder()
                .orderNumber("CLX-00002")
                .townName("Chirala")
                .placedAt(Instant.parse("2026-10-20T10:00:00Z"))
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PAID)
                .buyerPhone("9876511111")
                .itemsSubtotal(new BigDecimal("553.00"))
                .deliveryFee(BigDecimal.ZERO)
                .platformFee(new BigDecimal("1.00"))
                .taxAmount(new BigDecimal("64.95"))
                .totalAmount(new BigDecimal("554.00"))
                .lineItems(List.of(
                        InvoiceDocument.InvoiceLineItem.builder()
                                .itemName("Choco Cereal 500g")
                                .hsnCode("999799")
                                .quantity(1)
                                .gstPercent(new BigDecimal("18"))
                                .unitPrice(new BigDecimal("200.00"))
                                .cgstAmount(new BigDecimal("15.26"))
                                .sgstAmount(new BigDecimal("15.25"))
                                .cessAmount(BigDecimal.ZERO)
                                .lineTotal(new BigDecimal("200.00"))
                                .build(),
                        InvoiceDocument.InvoiceLineItem.builder()
                                .itemName("Butter 100g")
                                .hsnCode("999799")
                                .quantity(1)
                                .gstPercent(new BigDecimal("18"))
                                .unitPrice(new BigDecimal("58.00"))
                                .cgstAmount(new BigDecimal("4.43"))
                                .sgstAmount(new BigDecimal("4.42"))
                                .cessAmount(null)
                                .lineTotal(new BigDecimal("58.00"))
                                .build()))
                .build();

        byte[] pdf = invoicePdfService.generate(document);
        com.lowagie.text.pdf.PdfReader reader = new com.lowagie.text.pdf.PdfReader(pdf);
        String text = new com.lowagie.text.pdf.parser.PdfTextExtractor(reader).getTextFromPage(1);
        reader.close();

        assertThat(text).contains("Choco Cereal 500g");
        assertThat(text).contains("CGST");
        assertThat(text).contains("SGST");
        assertThat(text).doesNotContain("Cess");
    }
}
