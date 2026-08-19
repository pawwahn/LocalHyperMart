package com.hyperlocalmart.cart.client;

import com.hyperlocalmart.cart.config.CatalogServiceProperties;
import com.hyperlocalmart.cart.dto.response.CartSuggestionItemResponse;
import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CatalogSuggestionClient {

    private final RestClient.Builder restClientBuilder;
    private final CatalogServiceProperties catalogServiceProperties;

    public List<CartSuggestionItemResponse> suggest(
            UUID townId,
            List<UUID> excludeListingIds,
            List<UUID> seedMasterItemIds,
            List<String> seedNames,
            int limit) {
        try {
            RestClient client = restClientBuilder.baseUrl(catalogServiceProperties.getBaseUrl()).build();
            ApiResponse<List<CatalogItemSnapshot>> response = client.post()
                    .uri("/api/v1/internal/catalog/suggestions")
                    .body(new SuggestRequest(townId, excludeListingIds, seedMasterItemIds, seedNames, limit))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<CatalogItemSnapshot>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData().stream().map(this::toResponse).toList();
        } catch (RestClientResponseException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Could not load basket suggestions");
        }
    }

    private CartSuggestionItemResponse toResponse(CatalogItemSnapshot item) {
        return CartSuggestionItemResponse.builder()
                .listingId(item.listingId())
                .masterItemId(item.masterItemId())
                .categoryId(item.categoryId())
                .category(item.category())
                .name(item.name())
                .unit(item.unit())
                .shopName(item.shopName())
                .vendorId(item.vendorId())
                .mrp(item.mrp())
                .price(item.price())
                .discountPrice(item.discountPrice())
                .specialDiscountPrice(item.specialDiscountPrice())
                .effectivePrice(item.effectivePrice())
                .specialOfferActive(item.specialOfferActive())
                .vendorNote(item.vendorNote())
                .imageUrl(item.imageUrl())
                .imageUrls(item.imageUrls())
                .avgRating(item.avgRating())
                .ratingCount(item.ratingCount())
                .build();
    }

    private record SuggestRequest(
            UUID townId,
            List<UUID> excludeListingIds,
            List<UUID> seedMasterItemIds,
            List<String> seedNames,
            int limit) {
    }

    private record CatalogItemSnapshot(
            UUID listingId,
            UUID masterItemId,
            UUID categoryId,
            String category,
            String name,
            String unit,
            String shopName,
            UUID vendorId,
            BigDecimal mrp,
            BigDecimal price,
            BigDecimal discountPrice,
            BigDecimal specialDiscountPrice,
            BigDecimal effectivePrice,
            boolean specialOfferActive,
            String vendorNote,
            String imageUrl,
            List<String> imageUrls,
            BigDecimal avgRating,
            int ratingCount) {
    }
}
