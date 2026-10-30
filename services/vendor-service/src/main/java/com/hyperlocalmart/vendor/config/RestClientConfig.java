package com.hyperlocalmart.vendor.config;

import com.hyperlocalmart.common.security.RestClientConfigSupport;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import java.util.List;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient.Builder restClientBuilder(List<RestClientCustomizer> customizers) {
        return RestClientConfigSupport.applyCustomizers(RestClient.builder(), customizers);
    }
}
