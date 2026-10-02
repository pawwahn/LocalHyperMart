package com.hyperlocalmart.gateway.config;

import com.hyperlocalmart.gateway.security.GatewayAuthAttributes;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.util.Optional;

@Configuration
@EnableConfigurationProperties(GatewayRateLimitProperties.class)
public class GatewayRateLimitConfig {

    @Bean
    @ConditionalOnProperty(prefix = "hyperlocalmart.gateway.rate-limit", name = "enabled", havingValue = "true")
    public RedisRateLimiter redisRateLimiter(GatewayRateLimitProperties properties) {
        return new RedisRateLimiter(
                properties.getReplenishRate(),
                properties.getBurstCapacity(),
                properties.getRequestedTokens());
    }

    @Bean
    @ConditionalOnProperty(prefix = "hyperlocalmart.gateway.rate-limit", name = "enabled", havingValue = "true")
    public KeyResolver rateLimitKeyResolver() {
        return exchange -> {
            Object userId = exchange.getAttribute(GatewayAuthAttributes.USER_ID);
            if (userId != null && !userId.toString().isBlank()) {
                return Mono.just("user:" + userId);
            }
            return Mono.just("ip:" + resolveClientIp(exchange));
        };
    }

    private static String resolveClientIp(org.springframework.web.server.ServerWebExchange exchange) {
        String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return Optional.ofNullable(exchange.getRequest().getRemoteAddress())
                .map(InetSocketAddress::getAddress)
                .map(java.net.InetAddress::getHostAddress)
                .orElse("unknown");
    }
}
