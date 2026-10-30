package com.hyperlocalmart.town.config;

import com.hyperlocalmart.common.security.RestClientConfigSupport;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient.Builder restClientBuilder(List<RestClientCustomizer> customizers) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(4));
        return RestClientConfigSupport.applyCustomizers(
                RestClient.builder().requestFactory(requestFactory), customizers);
    }
}
