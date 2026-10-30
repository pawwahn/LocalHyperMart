package com.hyperlocalmart.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class InternalServiceAuthFilterTest {

    @Test
    void internalPathWithoutSecretWhenEnabled_returns404() throws Exception {
        InternalServiceAuthProperties properties = new InternalServiceAuthProperties();
        properties.setInternalServiceSecret("qa-shared-secret");
        InternalServiceAuthFilter filter = new InternalServiceAuthFilter(properties);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/internal/orders/abc");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> ((HttpServletResponse) res).setStatus(200);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(404);
    }

    @Test
    void internalPathWithValidSecret_continues() throws Exception {
        InternalServiceAuthProperties properties = new InternalServiceAuthProperties();
        properties.setInternalServiceSecret("qa-shared-secret");
        InternalServiceAuthFilter filter = new InternalServiceAuthFilter(properties);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/internal/orders/abc");
        request.addHeader(InternalServiceHeaders.SECRET, "qa-shared-secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> ((HttpServletResponse) res).setStatus(200);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void publicPathWithoutSecret_continuesWhenEnabled() throws Exception {
        InternalServiceAuthProperties properties = new InternalServiceAuthProperties();
        properties.setInternalServiceSecret("qa-shared-secret");
        InternalServiceAuthFilter filter = new InternalServiceAuthFilter(properties);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/orders");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> ((HttpServletResponse) res).setStatus(200);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
    }
}
