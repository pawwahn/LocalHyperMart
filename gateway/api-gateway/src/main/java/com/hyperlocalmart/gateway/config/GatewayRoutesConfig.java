package com.hyperlocalmart.gateway.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ServiceUris.class)
public class GatewayRoutesConfig {

    @Bean
    public RouteLocator gatewayRoutes(RouteLocatorBuilder builder, ServiceUris services) {
        return builder.routes()
                .route("user-service", r -> r.path(
                                "/api/v1/auth/**",
                                "/api/v1/users/**",
                                "/api/v1/addresses/**",
                                "/api/v1/referrals/**")
                        .uri(services.getUser()))
                .route("town-service", r -> r.path("/api/v1/towns/**", "/api/v1/platform/**", "/api/v1/geo/**")
                        .uri(services.getTown()))
                .route("vendor-service", r -> r.path("/api/v1/vendors/**")
                        .uri(services.getVendor()))
                .route("catalog-service", r -> r.path("/api/v1/catalog/**")
                        .uri(services.getCatalog()))
                .route("cart-service", r -> r.path("/api/v1/cart/**")
                        .uri(services.getCart()))
                .route("order-service", r -> r.path("/api/v1/orders/**")
                        .uri(services.getOrder()))
                .route("payment-service", r -> r.path("/api/v1/payments/**")
                        .uri(services.getPayment()))
                .route("delivery-service", r -> r.path("/api/v1/delivery/**")
                        .uri(services.getDelivery()))
                .route("notification-service", r -> r.path("/api/v1/notifications/**")
                        .uri(services.getNotification()))
                .route("billing-service", r -> r.path("/api/v1/billing/**")
                        .uri(services.getBilling()))
                .route("media-service", r -> r.path("/api/v1/media/**")
                        .uri(services.getMedia()))
                .route("reporting-service", r -> r.path("/api/v1/reports/**")
                        .uri(services.getReporting()))
                .build();
    }
}
