package com.hyperlocalmart.order.config;

import com.hyperlocalmart.common.security.RestClientConfigSupport;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

@Configuration
public class RestClientConfig {

    @Bean
    public JdkClientHttpRequestFactory httpRequestFactory() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(15));
        return requestFactory;
    }

    /** Prototype: callers must not share one builder across threads. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    public RestClient.Builder restClientBuilder(
            JdkClientHttpRequestFactory requestFactory, List<RestClientCustomizer> customizers) {
        return RestClientConfigSupport.applyCustomizers(
                RestClient.builder().requestFactory(requestFactory), customizers);
    }
}
