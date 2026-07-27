package com.hyperlocalmart.vendor.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.user-service")
public class UserServiceProperties {

    private String baseUrl = "http://localhost:8081";
}
