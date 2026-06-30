package com.hyperlocalmart.order.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.cart-service")
public class CartServiceProperties {

    private String baseUrl = "http://localhost:8085";
}
