package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.service.AddressService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AddressInternalController {

    private final AddressService addressService;

    @GetMapping("/api/v1/internal/addresses/{addressId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAddressSnapshot(
            @PathVariable UUID addressId,
            @RequestParam UUID userId,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                addressService.getAddressSnapshot(userId, addressId, townId)));
    }
}
