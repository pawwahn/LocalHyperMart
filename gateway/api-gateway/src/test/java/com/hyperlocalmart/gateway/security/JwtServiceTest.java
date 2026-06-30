package com.hyperlocalmart.gateway.security;

import com.hyperlocalmart.gateway.config.JwtProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET = "hyperlocalmart-dev-secret-change-in-production-min-32-chars!!";

    @Test
    void parseToken_readsClaims() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret(SECRET);
        JwtService jwtService = new JwtService(properties);

        UUID userId = UUID.randomUUID();
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject(userId.toString())
                .claim("phone", "9876543210")
                .claim("roles", List.of("BUYER"))
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(key)
                .compact();

        var claims = jwtService.parseToken(token);
        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.get("phone", String.class)).isEqualTo("9876543210");
    }
}
