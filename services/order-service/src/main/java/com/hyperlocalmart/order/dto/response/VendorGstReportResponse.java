package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class VendorGstReportResponse {
    LocalDate from;
    LocalDate to;
    UUID vendorId;
    long deliveredBagCount;
    long lineCount;
    BigDecimal taxableTotal;
    BigDecimal cgstTotal;
    BigDecimal sgstTotal;
    BigDecimal igstTotal;
    BigDecimal cessTotal;
    BigDecimal taxTotal;
    BigDecimal invoiceValueTotal;
    List<HsnGstRow> gstByHsn;
    List<B2cDocumentRow> b2cDocuments;
    List<LineDetailRow> lineDetails;

    @Value
    @Builder
    public static class HsnGstRow {
        String hsn;
        BigDecimal gstPercent;
        long lines;
        BigDecimal taxable;
        BigDecimal cgst;
        BigDecimal sgst;
        BigDecimal igst;
        BigDecimal cess;
        BigDecimal amount;
    }

    /** One row per delivered vendor bag — outward supply summary for GSTR-1 B2C working. */
    @Value
    @Builder
    public static class B2cDocumentRow {
        String orderNumber;
        String subOrderNumber;
        LocalDate deliveredDate;
        String paymentMethod;
        BigDecimal taxable;
        BigDecimal cgst;
        BigDecimal sgst;
        BigDecimal igst;
        BigDecimal cess;
        BigDecimal invoiceValue;
    }

    @Value
    @Builder
    public static class LineDetailRow {
        String orderNumber;
        String subOrderNumber;
        LocalDate deliveredDate;
        String itemName;
        String hsn;
        BigDecimal gstPercent;
        int quantity;
        BigDecimal taxable;
        BigDecimal cgst;
        BigDecimal sgst;
        BigDecimal igst;
        BigDecimal cess;
        BigDecimal lineTotal;
    }
}
