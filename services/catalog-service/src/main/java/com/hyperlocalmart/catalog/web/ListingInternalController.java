package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.response.ListingSnapshotResponse;
import com.hyperlocalmart.catalog.service.ListingLookupService;
import com.hyperlocalmart.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ListingInternalController {

    private final ListingLookupService listingLookupService;

    @GetMapping("/api/v1/internal/listings/{listingId}")
    public ResponseEntity<ApiResponse<ListingSnapshotResponse>> getListing(
            @PathVariable UUID listingId,
            @RequestParam UUID townId,
            @RequestParam(defaultValue = "true") boolean requireActive,
            HttpServletRequest httpRequest) {
        ListingSnapshotResponse data = requireActive
                ? listingLookupService.getActiveListing(listingId, townId)
                : listingLookupService.getListingForOrderRead(listingId, townId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, data));
    }
}
