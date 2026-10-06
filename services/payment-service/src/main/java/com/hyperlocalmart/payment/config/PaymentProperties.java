package com.hyperlocalmart.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.payment")
public class PaymentProperties {

    private String razorpayKeyId = "";
    private String razorpayKeySecret = "";
    private String razorpayWebhookSecret = "";
    private String razorpayApiBaseUrl = "https://api.razorpay.com/v1";
    private String checkoutName = "KoyaKart";
    private String checkoutLogoUrl = "";
    private String devWebhookBypassSecret = "dev-bypass";
    private int refundWorkingDays = 5;

    /** Informational TDS rate on vendor gross sales (e.g. 194O) — confirm with CA. */
    private BigDecimal vendorPayoutTdsRatePercent = new BigDecimal("1.00");

    public boolean isRazorpayConfigured() {
        return notBlank(razorpayKeyId) && notBlank(razorpayKeySecret);
    }

    public boolean isWebhookConfigured() {
        return notBlank(razorpayWebhookSecret);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
