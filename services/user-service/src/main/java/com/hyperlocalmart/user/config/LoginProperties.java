package com.hyperlocalmart.user.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.security.login")
public class LoginProperties {

    private int maxFailedAttempts = 5;
    private long lockDurationMinutes = 30;
}
