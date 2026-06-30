package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.service.CatalogBrowseService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/catalog")
@RequiredArgsConstructor
@Validated
public class CatalogController {

    private final CatalogBrowseService catalogBrowseService;

    @GetMapping("/items")
    public ResponseEntity<ApiResponse<PageResponse<CatalogItemResponse>>> browseItems(
            @RequestParam UUID townId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            HttpServletRequest httpRequest) {
        PageResponse<CatalogItemResponse> result = catalogBrowseService.browse(townId, q, page, size);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, result));
    }
}
