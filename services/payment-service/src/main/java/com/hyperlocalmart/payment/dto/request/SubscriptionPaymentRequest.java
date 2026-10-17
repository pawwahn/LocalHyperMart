package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Vendor submitting payment for a sent bill (method + reference required), or admin confirming it
 * (blank fields fall back to what the vendor submitted).
 */
@Data
public class SubscriptionPaymentRequest {
    @Size(max = 32)
    private String payoutMethod;
    @Size(max = 128)
    private String transactionReference;
    @Size(max = 500)
    private String transactionNotes;
}
