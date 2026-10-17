package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RejectSubscriptionPaymentRequest {
    @NotBlank(message = "Add a short reason so the vendor knows why payment was rejected")
    @Size(max = 500)
    private String reason;
}
