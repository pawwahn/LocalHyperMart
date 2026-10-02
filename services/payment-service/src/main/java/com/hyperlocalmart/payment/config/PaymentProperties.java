package com.hyperlocalmart.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.payment")
public class PaymentProperties {

    private String razorpayKeyId = "";
    private String razorpayKeySecret = "";
    private String razorpayWebhookSecret = "";
    private String razorpayApiBaseUrl = "https://api.razorpay.com/v1";
    private String checkoutName = "KoYaKart";
    private String checkoutLogoUrl = "";
    private String devWebhookBypassSecret = "dev-bypass";
    private int refundWorkingDays = 5;

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
