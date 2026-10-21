package com.hyperlocalmart.payment.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hyperlocalmart.payment.entity.PaymentGateway;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConfirmGatewayPaymentRequest {

    private PaymentGateway gateway;

    private String gatewayOrderId;

    @JsonAlias("razorpay_order_id")
    private String razorpayOrderId;

    @JsonAlias("razorpay_payment_id")
    private String razorpayPaymentId;

    @JsonAlias("razorpay_signature")
    private String razorpaySignature;
}
