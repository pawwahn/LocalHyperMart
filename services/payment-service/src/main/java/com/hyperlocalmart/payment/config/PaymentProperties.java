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
    private String cashfreeClientId = "";
    private String cashfreeClientSecret = "";
    private String cashfreeApiBaseUrl = "https://sandbox.cashfree.com/pg";
    private String cashfreeApiVersion = "2023-08-01";
    private String phonepeClientId = "";
    private String phonepeClientSecret = "";
    private String phonepeClientVersion = "1";
    private String phonepeEnv = "sandbox";
    private String phonepeWebhookUsername = "";
    private String phonepeWebhookPassword = "";
    private String paymentReturnUrl = "http://localhost:5175/shop";
    private String checkoutName = "KoyaKart";
    private String checkoutLogoUrl = "";
    private String devWebhookBypassSecret = "dev-bypass";
    private int refundWorkingDays = 5;

    /** True after an admin saves this gateway as off. Env keys stay usable until then. */
    private boolean razorpayAdminDisabled;
    private boolean cashfreeAdminDisabled;
    private boolean phonepeAdminDisabled;

    /** Informational TDS rate on vendor gross sales (e.g. 194O) — confirm with CA. */
    private BigDecimal vendorPayoutTdsRatePercent = new BigDecimal("1.00");

    public boolean isRazorpayConfigured() {
        return !razorpayAdminDisabled && notBlank(razorpayKeyId) && notBlank(razorpayKeySecret);
    }

    public boolean isCashfreeConfigured() {
        return !cashfreeAdminDisabled && notBlank(cashfreeClientId) && notBlank(cashfreeClientSecret);
    }

    public boolean isPhonePeConfigured() {
        return !phonepeAdminDisabled && notBlank(phonepeClientId) && notBlank(phonepeClientSecret);
    }

    public boolean isCashfreeSandbox() {
        return cashfreeApiBaseUrl != null && cashfreeApiBaseUrl.contains("sandbox");
    }

    public boolean isPhonePeSandbox() {
        return phonepeEnv == null || !phonepeEnv.equalsIgnoreCase("production");
    }

    public boolean isWebhookConfigured() {
        return notBlank(razorpayWebhookSecret);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
