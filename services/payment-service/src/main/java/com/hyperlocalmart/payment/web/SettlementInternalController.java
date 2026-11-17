package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.dto.request.CancellationPenaltyLookupRequest;
import com.hyperlocalmart.payment.dto.request.CreateVendorSettlementAdjustmentRequest;
import com.hyperlocalmart.payment.dto.response.VendorSettlementAdjustmentResponse;
import com.hyperlocalmart.payment.service.CancellationPenaltyService;
import com.hyperlocalmart.payment.service.VendorSettlementAdjustmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/settlements")
@RequiredArgsConstructor
public class SettlementInternalController {

    private final VendorSettlementAdjustmentService vendorSettlementAdjustmentService;
    private final CancellationPenaltyService cancellationPenaltyService;

    @PostMapping("/cancellation-penalties/lookup")
    public ResponseEntity<ApiResponse<List<UUID>>> lookupCancellationPenalties(
            @Valid @RequestBody CancellationPenaltyLookupRequest request,
            HttpServletRequest httpRequest) {
        Set<UUID> penalized = cancellationPenaltyService.findPenalizedOrderIds(request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, penalized.stream().sorted().toList()));
    }

    @PostMapping("/vendor-adjustments")
    public ResponseEntity<ApiResponse<VendorSettlementAdjustmentResponse>> recordVendorAdjustment(
            @Valid @RequestBody CreateVendorSettlementAdjustmentRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest,
                        vendorSettlementAdjustmentService.recordClaimChargeback(request)));
    }
}
