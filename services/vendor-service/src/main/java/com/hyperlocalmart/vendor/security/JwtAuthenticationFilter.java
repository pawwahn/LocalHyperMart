package com.hyperlocalmart.vendor.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            AuthUserPrincipal principal = principalFromJwt(request);
            if (principal == null) {
                // Gateway already validated JWT and forwards trusted identity headers.
                principal = principalFromGatewayHeaders(request);
            }
            if (principal != null) {
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }
        filterChain.doFilter(request, response);
    }

    private AuthUserPrincipal principalFromJwt(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return null;
        }
        try {
            Claims claims = jwtService.parseToken(header.substring(7));
            UUID userId = UUID.fromString(claims.getSubject());
            String phone = claims.get("phone", String.class);
            @SuppressWarnings("unchecked")
            List<String> roles = claims.get("roles", List.class);
            return new AuthUserPrincipal(userId, phone, roles);
        } catch (Exception ignored) {
            return null;
        }
    }

    private AuthUserPrincipal principalFromGatewayHeaders(HttpServletRequest request) {
        String userIdRaw = request.getHeader("X-User-Id");
        String rolesRaw = request.getHeader("X-User-Roles");
        if (userIdRaw == null || userIdRaw.isBlank()) {
            return null;
        }
        try {
            UUID userId = UUID.fromString(userIdRaw.trim());
            String phone = request.getHeader("X-User-Phone");
            List<String> roles = rolesRaw == null || rolesRaw.isBlank()
                    ? List.of()
                    : Arrays.stream(rolesRaw.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();
            return new AuthUserPrincipal(userId, phone, roles);
        } catch (Exception ignored) {
            return null;
        }
    }
}
