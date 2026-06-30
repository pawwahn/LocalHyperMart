package com.hyperlocalmart.delivery.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.order-service")
public class OrderServiceProperties {

    private String baseUrl = "http://localhost:8086";
}
