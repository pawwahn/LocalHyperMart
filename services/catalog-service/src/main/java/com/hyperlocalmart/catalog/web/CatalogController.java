package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.catalog.dto.request.ListingPrimaryImagesRequest;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.dto.response.ListingPrimaryImageResponse;
import com.hyperlocalmart.catalog.service.CatalogBrowseService;
import com.hyperlocalmart.catalog.service.ListingPrimaryImageService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/catalog")
@RequiredArgsConstructor
@Validated
public class CatalogController {

    private final CatalogBrowseService catalogBrowseService;
    private final ListingPrimaryImageService listingPrimaryImageService;

    @PostMapping("/listing-primary-images")
    public ResponseEntity<ApiResponse<List<ListingPrimaryImageResponse>>> listingPrimaryImages(
            @Valid @RequestBody ListingPrimaryImagesRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, listingPrimaryImageService.primaryImages(request.getListingIds())));
    }

    @GetMapping("/items")
    public ResponseEntity<ApiResponse<PageResponse<CatalogItemResponse>>> browseItems(
            @RequestParam UUID townId,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "24") @Min(1) @Max(48) int size,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String dir,
            @RequestParam(required = false) String lane,
            HttpServletRequest httpRequest) {
        PageResponse<CatalogItemResponse> result =
                catalogBrowseService.browse(townId, categoryId, q, page, size, sort, dir, lane);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, result));
    }

    @GetMapping("/items/discounted")
    public ResponseEntity<ApiResponse<Map<String, List<CatalogItemResponse>>>> discountedItems(
            @RequestParam UUID townId,
            @RequestParam(defaultValue = "24") @Min(1) @Max(40) int limit,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, Map.of("items", catalogBrowseService.topDiscountedInTown(townId, Set.of(), limit))));
    }

    @GetMapping("/items/by-ids")
    public ResponseEntity<ApiResponse<Map<String, List<CatalogItemResponse>>>> itemsByIds(
            @RequestParam UUID townId,
            @RequestParam List<UUID> ids,
            HttpServletRequest httpRequest) {
        List<UUID> capped = ids == null ? List.of() : ids.stream().filter(id -> id != null).distinct().limit(40).toList();
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, Map.of("items", catalogBrowseService.activeByIdsInTown(townId, capped))));
    }
}
