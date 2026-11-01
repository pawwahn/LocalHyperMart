package com.hyperlocalmart.notification.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "hyperlocalmart.user-service")
public class UserServiceProperties {

    private String baseUrl = "http://localhost:8081";
}
