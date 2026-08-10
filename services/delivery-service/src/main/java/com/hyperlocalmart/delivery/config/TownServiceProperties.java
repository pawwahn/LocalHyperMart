package com.hyperlocalmart.delivery.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "hyperlocalmart.town-service")
public class TownServiceProperties {
    private String baseUrl = "http://localhost:8082";
}
