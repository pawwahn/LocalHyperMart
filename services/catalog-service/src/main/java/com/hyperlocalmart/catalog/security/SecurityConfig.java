package com.hyperlocalmart.catalog.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/internal/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/items").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/master-items").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/master-items/*/images").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/catalog/master-items").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/catalog/master-items/*").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/catalog/master-items/*").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/v1/catalog/master-items/*/images").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/categories").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/catalog/categories").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/catalog/categories/*").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/catalog/categories/*").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/units").permitAll()
                        .requestMatchers("/api/v1/catalog/admin/**").authenticated()
                        .requestMatchers("/api/v1/catalog/vendors/**").authenticated()
                        .anyRequest().permitAll())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
