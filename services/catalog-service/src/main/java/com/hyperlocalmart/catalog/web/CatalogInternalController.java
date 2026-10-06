package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.request.CartSuggestionsRequest;
import com.hyperlocalmart.catalog.dto.request.ListingPrimaryImagesRequest;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.dto.response.ListingPrimaryImageResponse;
import com.hyperlocalmart.catalog.service.CatalogSuggestionService;
import com.hyperlocalmart.catalog.service.ListingPrimaryImageService;
import com.hyperlocalmart.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CatalogInternalController {

    private final CatalogSuggestionService catalogSuggestionService;
    private final ListingPrimaryImageService listingPrimaryImageService;

    @PostMapping("/api/v1/internal/catalog/listing-primary-images")
    public ResponseEntity<ApiResponse<List<ListingPrimaryImageResponse>>> listingPrimaryImages(
            @Valid @RequestBody ListingPrimaryImagesRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, listingPrimaryImageService.primaryImages(request.getListingIds())));
    }

    @PostMapping("/api/v1/internal/catalog/suggestions")
    public ResponseEntity<ApiResponse<List<CatalogItemResponse>>> suggestForCart(
            @Valid @RequestBody CartSuggestionsRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, catalogSuggestionService.suggest(request)));
    }
}
