package com.hyperlocalmart.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RequiredArgsConstructor
public class InternalServiceAuthFilter extends OncePerRequestFilter {

    private final InternalServiceAuthProperties properties;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!properties.isEnabled() || !isInternalPath(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        String provided = request.getHeader(InternalServiceHeaders.SECRET);
        if (!secretMatches(provided)) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static boolean isInternalPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path != null && path.startsWith("/api/v1/internal/");
    }

    private boolean secretMatches(String provided) {
        if (provided == null || provided.isBlank()) {
            return false;
        }
        byte[] expected = properties.getInternalServiceSecret().getBytes(StandardCharsets.UTF_8);
        byte[] actual = provided.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }
}
