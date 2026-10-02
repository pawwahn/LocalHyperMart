package com.hyperlocalmart.gateway.config;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.GatewayFilterSpec;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({ServiceUris.class, GatewayRateLimitProperties.class})
public class GatewayRoutesConfig {

    @Bean
    public RouteLocator gatewayRoutes(
            RouteLocatorBuilder builder,
            ServiceUris services,
            GatewayRateLimitProperties rateLimit,
            ObjectProvider<RedisRateLimiter> rateLimiter,
            ObjectProvider<KeyResolver> keyResolver) {
        return builder.routes()
                .route("user-service", r -> r.path(
                                "/api/v1/auth/**",
                                "/api/v1/users/**",
                                "/api/v1/addresses/**",
                                "/api/v1/referrals/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getUser()))
                .route("town-service", r -> r.path("/api/v1/towns/**", "/api/v1/platform/**", "/api/v1/geo/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getTown()))
                .route("vendor-service", r -> r.path("/api/v1/vendors/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getVendor()))
                .route("catalog-service", r -> r.path("/api/v1/catalog/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getCatalog()))
                .route("cart-service", r -> r.path("/api/v1/cart/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getCart()))
                .route("order-service", r -> r.path("/api/v1/orders/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getOrder()))
                .route("payment-service", r -> r.path("/api/v1/payments/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getPayment()))
                .route("delivery-service", r -> r.path("/api/v1/delivery/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getDelivery()))
                .route("notification-service", r -> r.path("/api/v1/notifications/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getNotification()))
                .route("billing-service", r -> r.path("/api/v1/billing/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getBilling()))
                .route("media-service", r -> r.path("/api/v1/media/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getMedia()))
                .route("reporting-service", r -> r.path("/api/v1/reports/**")
                        .filters(f -> withRateLimit(f, rateLimit, rateLimiter, keyResolver))
                        .uri(services.getReporting()))
                .build();
    }

    private static GatewayFilterSpec withRateLimit(
            GatewayFilterSpec filters,
            GatewayRateLimitProperties rateLimit,
            ObjectProvider<RedisRateLimiter> rateLimiter,
            ObjectProvider<KeyResolver> keyResolver) {
        if (!rateLimit.isEnabled()) {
            return filters;
        }
        RedisRateLimiter limiter = rateLimiter.getIfAvailable();
        KeyResolver resolver = keyResolver.getIfAvailable();
        if (limiter == null || resolver == null) {
            return filters;
        }
        return filters.requestRateLimiter(config -> {
            config.setRateLimiter(limiter);
            config.setKeyResolver(resolver);
        });
    }
}
