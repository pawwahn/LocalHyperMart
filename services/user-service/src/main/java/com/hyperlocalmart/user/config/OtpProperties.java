package com.hyperlocalmart.user.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.security.otp")
public class OtpProperties {

    private long expirationMinutes = 5;
    private int maxRequestsPerHour = 5;
    private int maxVerifyAttempts = 5;

    /**
     * When set (local/dev), password-reset OTP uses this fixed code instead of a random value.
     * Leave empty in production.
     */
    private String fixedCode = "111111";
}
