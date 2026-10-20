package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.vendor.dto.request.CommercialTermsQuoteRequest;
import com.hyperlocalmart.vendor.dto.response.CommercialTermsQuoteResponse;
import com.hyperlocalmart.vendor.dto.response.MonthSubscriptionAmount;
import com.hyperlocalmart.vendor.service.VendorCommercialTermsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CommercialTermsInternalController {

    private final VendorCommercialTermsService vendorCommercialTermsService;

    @PostMapping("/api/v1/internal/vendors/{vendorId}/commercial-terms/quote")
    public ResponseEntity<ApiResponse<CommercialTermsQuoteResponse>> quote(
            @PathVariable UUID vendorId,
            @Valid @RequestBody CommercialTermsQuoteRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, vendorCommercialTermsService.quote(vendorId, request)));
    }

    @PostMapping("/api/v1/internal/vendors/{vendorId}/commercial-terms/subscription-months")
    public ResponseEntity<ApiResponse<List<MonthSubscriptionAmount>>> subscriptionMonths(
            @PathVariable UUID vendorId,
            @RequestBody(required = false) Map<String, List<String>> body,
            HttpServletRequest httpRequest) {
        List<LocalDate> ends = new ArrayList<>();
        if (body != null && body.get("periodEnds") != null) {
            for (String raw : body.get("periodEnds")) {
                if (raw != null && !raw.isBlank()) {
                    ends.add(LocalDate.parse(raw));
                }
            }
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorCommercialTermsService.subscriptionAmounts(vendorId, ends)));
    }

    @PostMapping("/api/v1/internal/vendors/{vendorId}/commercial-terms/mark-subscription-charged")
    public ResponseEntity<ApiResponse<Map<String, Object>>> markSubscriptionCharged(
            @PathVariable UUID vendorId,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest httpRequest) {
        LocalDate periodEnd = null;
        if (body != null && body.get("periodEnd") != null && !body.get("periodEnd").isBlank()) {
            periodEnd = LocalDate.parse(body.get("periodEnd"));
        }
        String ym = vendorCommercialTermsService.markSubscriptionCharged(vendorId, periodEnd);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "vendorId", vendorId.toString(),
                "chargedYm", ym
        )));
    }
}
