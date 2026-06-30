package com.hyperlocalmart.gateway.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GatewayRoutesConfig {

    @Bean
    public RouteLocator gatewayRoutes(RouteLocatorBuilder builder) {
        return builder.routes()
                .route("user-service", r -> r.path("/api/v1/auth/**", "/api/v1/users/**", "/api/v1/addresses/**")
                        .uri("http://localhost:8081"))
                .route("town-service", r -> r.path("/api/v1/towns/**", "/api/v1/platform/**")
                        .uri("http://localhost:8082"))
                .route("vendor-service", r -> r.path("/api/v1/vendors/**")
                        .uri("http://localhost:8083"))
                .route("catalog-service", r -> r.path("/api/v1/catalog/**")
                        .uri("http://localhost:8084"))
                .route("cart-service", r -> r.path("/api/v1/cart/**")
                        .uri("http://localhost:8085"))
                .route("order-service", r -> r.path("/api/v1/orders/**")
                        .uri("http://localhost:8086"))
                .route("payment-service", r -> r.path("/api/v1/payments/**")
                        .uri("http://localhost:8087"))
                .route("delivery-service", r -> r.path("/api/v1/delivery/**")
                        .uri("http://localhost:8088"))
                .route("notification-service", r -> r.path("/api/v1/notifications/**")
                        .uri("http://localhost:8089"))
                .route("billing-service", r -> r.path("/api/v1/billing/**")
                        .uri("http://localhost:8090"))
                .route("media-service", r -> r.path("/api/v1/media/**")
                        .uri("http://localhost:8091"))
                .route("reporting-service", r -> r.path("/api/v1/reports/**")
                        .uri("http://localhost:8092"))
                .build();
    }
}
