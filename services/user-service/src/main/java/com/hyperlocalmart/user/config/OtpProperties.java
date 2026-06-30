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
}
