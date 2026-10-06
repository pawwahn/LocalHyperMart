package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.CommercialTermsQuoteRequest;
import com.hyperlocalmart.vendor.dto.response.CommercialTermsQuoteResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.VendorCommercialTermsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/vendors/me/commercial-terms")
@RequiredArgsConstructor
public class VendorMeCommercialTermsController {

    private final VendorCommercialTermsService vendorCommercialTermsService;

    @PostMapping("/quote")
    public ResponseEntity<ApiResponse<CommercialTermsQuoteResponse>> quote(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CommercialTermsQuoteRequest request,
            HttpServletRequest httpRequest) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorCommercialTermsService.quoteForVendorUser(principal.getUserId(), request)));
    }
}
