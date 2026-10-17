package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** One month of a vendor's monthly subscription — billed on its own, never mixed with order fees. */
@Value
@Builder
public class SubscriptionBillView {
    /** yyyy-MM */
    String month;
    LocalDate periodStart;
    LocalDate periodEnd;
    BigDecimal amount;
    /**
     * NOT_SENT (due, no bill yet) · SENT (awaiting vendor) · PAYMENT_SUBMITTED (vendor paid, admin to confirm)
     * · REJECTED (admin rejected the submitted payment; vendor to pay / resubmit) · PAID
     */
    String status;
    UUID settlementId;
    Instant billSentAt;
    Instant vendorPaidAt;
    /** yyyy-MM-dd on the bank statement. Null until admin sets it. */
    LocalDate bankPaidOn;
    String vendorPaymentMethod;
    String vendorPaymentReference;
    String vendorPaymentNotes;
    Instant rejectedAt;
    String rejectReason;
    Instant paidAt;
    String payoutMethod;
    String transactionReference;
    String invoiceNumber;
}
