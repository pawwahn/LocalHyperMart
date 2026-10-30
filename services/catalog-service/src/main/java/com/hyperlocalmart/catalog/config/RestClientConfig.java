package com.hyperlocalmart.catalog.config;

import com.hyperlocalmart.common.security.RestClientConfigSupport;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient.Builder restClientBuilder(List<RestClientCustomizer> customizers) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(800));
        factory.setReadTimeout(Duration.ofMillis(1500));
        return RestClientConfigSupport.applyCustomizers(
                RestClient.builder().requestFactory(factory), customizers);
    }
}
