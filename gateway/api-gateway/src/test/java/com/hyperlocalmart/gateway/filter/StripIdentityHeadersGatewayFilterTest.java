package com.hyperlocalmart.gateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;

class StripIdentityHeadersGatewayFilterTest {

    private final StripIdentityHeadersGatewayFilter filter = new StripIdentityHeadersGatewayFilter();

    @Test
    void removesSpoofedIdentityHeaders() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/cart")
                .header(StripIdentityHeadersGatewayFilter.USER_ID, "00000000-0000-0000-0000-000000000001")
                .header(StripIdentityHeadersGatewayFilter.USER_ROLES, "SUPER_ADMIN")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        final ServerWebExchange[] captured = new ServerWebExchange[1];

        GatewayFilterChain chain = ex -> {
            captured[0] = ex;
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertThat(captured[0]).isNotNull();
        assertThat(captured[0].getRequest().getHeaders().getFirst(StripIdentityHeadersGatewayFilter.USER_ID)).isNull();
        assertThat(captured[0].getRequest().getHeaders().getFirst(StripIdentityHeadersGatewayFilter.USER_ROLES)).isNull();
    }
}
