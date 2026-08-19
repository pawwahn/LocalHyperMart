package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.request.CartSuggestionsRequest;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.service.CatalogSuggestionService;
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

    @PostMapping("/api/v1/internal/catalog/suggestions")
    public ResponseEntity<ApiResponse<List<CatalogItemResponse>>> suggestForCart(
            @Valid @RequestBody CartSuggestionsRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, catalogSuggestionService.suggest(request)));
    }
}
