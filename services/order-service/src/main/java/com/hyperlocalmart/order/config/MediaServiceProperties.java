package com.hyperlocalmart.order.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.media-service")
public class MediaServiceProperties {

    private String baseUrl = "http://localhost:8091";
}
