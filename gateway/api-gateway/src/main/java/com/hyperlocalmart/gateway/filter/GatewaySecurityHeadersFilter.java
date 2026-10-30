package com.hyperlocalmart.gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class GatewaySecurityHeadersFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        return chain.filter(exchange).then(Mono.fromRunnable(() -> {
            var headers = exchange.getResponse().getHeaders();
            if (!headers.containsKey("X-Content-Type-Options")) {
                headers.add("X-Content-Type-Options", "nosniff");
            }
            if (!headers.containsKey("X-Frame-Options")) {
                headers.add("X-Frame-Options", "DENY");
            }
            if (!headers.containsKey("Referrer-Policy")) {
                headers.add("Referrer-Policy", "strict-origin-when-cross-origin");
            }
            if (!headers.containsKey("Permissions-Policy")) {
                headers.add("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
            }
        }));
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
