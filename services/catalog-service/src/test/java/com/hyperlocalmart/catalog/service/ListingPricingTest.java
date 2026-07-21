package com.hyperlocalmart.catalog.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class ListingPricingTest {

    @Test
    void resolveEffectivePrice_usesSpecialWhenActive() {
        Instant now = Instant.parse("2026-06-24T12:00:00Z");
        BigDecimal effective = ListingPricing.resolveEffectivePrice(
                new BigDecimal("30.00"),
                new BigDecimal("28.00"),
                new BigDecimal("25.00"),
                now.minus(1, ChronoUnit.DAYS),
                now.plus(1, ChronoUnit.DAYS),
                now);
        assertThat(effective).isEqualByComparingTo("25.00");
    }

    @Test
    void resolveEffectivePrice_fallsBackToDiscountWhenSpecialExpired() {
        Instant now = Instant.parse("2026-06-24T12:00:00Z");
        BigDecimal effective = ListingPricing.resolveEffectivePrice(
                new BigDecimal("30.00"),
                new BigDecimal("28.00"),
                new BigDecimal("25.00"),
                now.minus(5, ChronoUnit.DAYS),
                now.minus(1, ChronoUnit.DAYS),
                now);
        assertThat(effective).isEqualByComparingTo("28.00");
    }

    @Test
    void resolveEffectivePrice_usesRegularWhenNoOffers() {
        BigDecimal effective = ListingPricing.resolveEffectivePrice(
                new BigDecimal("30.00"),
                null,
                null,
                null,
                null,
                Instant.now());
        assertThat(effective).isEqualByComparingTo("30.00");
    }
}
