package com.hyperlocalmart.order.config;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Builds a client for one base URL.
 * {@link RestClient.Builder} is mutable and not thread-safe. Booking loads lab, patient,
 * address, and town settings at the same time, so each call needs its own builder.
 */
@Component
public class RestClientFactory {

    private final ObjectProvider<RestClient.Builder> builders;

    public RestClientFactory(ObjectProvider<RestClient.Builder> builders) {
        this.builders = builders;
    }

    public RestClient forBaseUrl(String baseUrl) {
        return builders.getObject().baseUrl(baseUrl).build();
    }
}
