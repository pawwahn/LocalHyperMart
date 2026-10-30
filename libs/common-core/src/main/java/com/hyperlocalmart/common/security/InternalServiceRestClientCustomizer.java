package com.hyperlocalmart.common.security;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@RequiredArgsConstructor
public class InternalServiceRestClientCustomizer implements RestClientCustomizer {

    private final InternalServiceAuthProperties properties;

    @Override
    public void customize(RestClient.Builder builder) {
        if (!properties.isEnabled()) {
            return;
        }
        builder.defaultRequest(request -> request.header(
                InternalServiceHeaders.SECRET, properties.getInternalServiceSecret()));
    }
}
