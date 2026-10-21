package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.dto.response.CatalogHomeRailResponse;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogHomeRailsTest {

    @Test
    void skipsShortRailsAndRepeatsAndPricesAboveTheCap() {
        UUID dairy = UUID.randomUUID();
        UUID health = UUID.randomUUID();
        UUID shared = UUID.randomUUID();
        CategoryResponse dairyCategory = CategoryResponse.builder().id(dairy).name("Dairy, Bread and Eggs").build();
        CategoryResponse healthCategory = CategoryResponse.builder().id(health).name("Health and Nutrition").build();

        CatalogItemResponse cheap = item(shared, new BigDecimal("40"));
        CatalogItemResponse pricey = item(UUID.randomUUID(), new BigDecimal("1200"));
        List<CatalogItemResponse> healthItems = List.of(
                cheap,
                pricey,
                item(UUID.randomUUID(), new BigDecimal("100")),
                item(UUID.randomUUID(), new BigDecimal("200")),
                item(UUID.randomUUID(), new BigDecimal("300")));

        List<CatalogHomeRailResponse> rails = CatalogHomeRails.build(
                List.of(dairyCategory, healthCategory),
                Map.of(
                        dairy, List.of(cheap, item(UUID.randomUUID(), new BigDecimal("10")), item(UUID.randomUUID(), new BigDecimal("12"))),
                        health, healthItems));

        assertThat(rails).extracting(CatalogHomeRailResponse::getId).containsExactly("fresh", "health");
        assertThat(rails.get(1).getItems()).extracting(CatalogItemResponse::getListingId)
                .doesNotContain(shared, pricey.getListingId());
        assertThat(rails.get(1).getItems()).hasSize(3);
    }

    @Test
    void dropsARailWithFewerThanThreeProducts() {
        UUID skin = UUID.randomUUID();
        List<CatalogHomeRailResponse> rails = CatalogHomeRails.build(
                List.of(CategoryResponse.builder().id(skin).name("Skin care").build()),
                Map.of(skin, List.of(item(UUID.randomUUID(), BigDecimal.TEN), item(UUID.randomUUID(), BigDecimal.ONE))));

        assertThat(rails).isEmpty();
    }

    private static CatalogItemResponse item(UUID id, BigDecimal effective) {
        return CatalogItemResponse.builder().listingId(id).effectivePrice(effective).price(effective).build();
    }
}
