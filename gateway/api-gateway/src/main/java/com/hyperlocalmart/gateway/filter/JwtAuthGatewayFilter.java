package com.hyperlocalmart.gateway.filter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.gateway.security.JwtService;
import com.hyperlocalmart.gateway.security.PublicRouteMatcher;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class JwtAuthGatewayFilter implements GlobalFilter, Ordered {

    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        if (PublicRouteMatcher.isInternalBlocked(path)) {
            return errorResponse(exchange, HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found");
        }

        if (PublicRouteMatcher.isPublic(request.getMethod(), path)) {
            return chain.filter(exchange);
        }

        String authorization = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or invalid JWT");
        }

        try {
            Claims claims = jwtService.parseToken(authorization.substring(7));
            ServerHttpRequest mutated = request.mutate()
                    .header("X-User-Id", claims.getSubject())
                    .header("X-User-Phone", claims.get("phone", String.class))
                    .header("X-User-Roles", stringifyRoles(claims.get("roles", List.class)))
                    .build();
            return chain.filter(exchange.mutate().request(mutated).build());
        } catch (Exception ex) {
            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or invalid JWT");
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 1;
    }

    private String stringifyRoles(List<?> roles) {
        if (roles == null || roles.isEmpty()) {
            return "";
        }
        return String.join(",", roles.stream().map(Object::toString).toList());
    }

    private Mono<Void> errorResponse(ServerWebExchange exchange, HttpStatus status, String code, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("message", message);
        body.put("data", null);
        body.put("timestamp", Instant.now().toString());
        body.put("correlationId", exchange.getRequest().getHeaders().getFirst(CorrelationIdGatewayFilter.CORRELATION_HEADER));

        byte[] bytes;
        try {
            bytes = objectMapper.writeValueAsBytes(body);
        } catch (JsonProcessingException e) {
            bytes = ("{\"success\":false,\"message\":\"" + message + "\"}").getBytes(StandardCharsets.UTF_8);
        }
        DataBuffer buffer = response.bufferFactory().wrap(bytes);
        return response.writeWith(Mono.just(buffer));
    }
}
