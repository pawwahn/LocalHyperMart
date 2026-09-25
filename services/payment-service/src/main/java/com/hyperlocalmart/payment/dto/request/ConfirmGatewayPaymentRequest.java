package com.hyperlocalmart.payment.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConfirmGatewayPaymentRequest {

    @NotBlank
    @JsonAlias("razorpay_order_id")
    private String razorpayOrderId;

    @NotBlank
    @JsonAlias("razorpay_payment_id")
    private String razorpayPaymentId;

    @NotBlank
    @JsonAlias("razorpay_signature")
    private String razorpaySignature;
}
