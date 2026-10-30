package com.hyperlocalmart.common.security;

import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.web.client.RestClient;

import java.util.List;

public final class RestClientConfigSupport {

    private RestClientConfigSupport() {
    }

    public static RestClient.Builder applyCustomizers(
            RestClient.Builder builder, List<RestClientCustomizer> customizers) {
        if (customizers != null) {
            customizers.forEach(customizer -> customizer.customize(builder));
        }
        return builder;
    }
}
