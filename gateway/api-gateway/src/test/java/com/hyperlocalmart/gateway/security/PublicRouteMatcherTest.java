package com.hyperlocalmart.gateway.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import static org.assertj.core.api.Assertions.assertThat;

class PublicRouteMatcherTest {

    @Test
    void authRegister_isPublic() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.POST, "/api/v1/auth/register")).isTrue();
    }

    @Test
    void townsList_isPublic() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/towns")).isTrue();
    }

    @Test
    void catalogBrowse_isPublic() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/catalog/items")).isTrue();
    }

    @Test
    void cartRequiresAuth() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/cart")).isFalse();
    }

    @Test
    void internalPathsAreBlocked() {
        assertThat(PublicRouteMatcher.isInternalBlocked("/api/v1/internal/carts/abc")).isTrue();
    }

    @Test
    void townDetailRequiresAuth() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/towns/abc-123")).isFalse();
    }
}
