package com.hyperlocalmart.cart.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.catalog-service")
public class CatalogServiceProperties {

    private String baseUrl = "http://localhost:8084";
}
