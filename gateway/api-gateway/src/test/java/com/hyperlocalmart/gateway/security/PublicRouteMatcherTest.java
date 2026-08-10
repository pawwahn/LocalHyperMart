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
    void platformPublicSettings_isPublic() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/platform/settings/public")).isTrue();
    }

    @Test
    void platformAdminSettings_requiresAuth() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/platform/settings")).isFalse();
    }

    @Test
    void catalogBrowse_isPublic() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/catalog/items")).isTrue();
    }

    @Test
    void geoCountries_isPublic() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/geo/countries")).isTrue();
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
    void townDeliveryFeePreview_isPublic() {
        assertThat(PublicRouteMatcher.isPublic(
                HttpMethod.GET, "/api/v1/towns/abc-123/delivery-fee")).isTrue();
    }

    @Test
    void townAdsPublic_isPublic() {
        assertThat(PublicRouteMatcher.isPublic(
                HttpMethod.GET, "/api/v1/towns/abc-123/ads")).isTrue();
    }

    @Test
    void townAdsEditor_requiresAuth() {
        assertThat(PublicRouteMatcher.isPublic(
                HttpMethod.GET, "/api/v1/towns/abc-123/ads/editor")).isFalse();
    }

    @Test
    void townDetailRequiresAuth() {
        assertThat(PublicRouteMatcher.isPublic(HttpMethod.GET, "/api/v1/towns/abc-123")).isFalse();
    }
}
