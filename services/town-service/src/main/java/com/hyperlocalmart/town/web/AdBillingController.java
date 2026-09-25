package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.town.dto.billing.AdInvoiceResponse;
import com.hyperlocalmart.town.dto.billing.AdOccupancyResponse;
import com.hyperlocalmart.town.dto.billing.AdQuoteRequest;
import com.hyperlocalmart.town.dto.billing.AdQuoteResponse;
import com.hyperlocalmart.town.dto.billing.AdRateCardResponse;
import com.hyperlocalmart.town.dto.billing.CreateAdInvoiceRequest;
import com.hyperlocalmart.town.dto.billing.PayAdInvoiceRequest;
import com.hyperlocalmart.town.dto.billing.UpsertAdRateCardRequest;
import com.hyperlocalmart.town.dto.billing.VoidAdInvoiceRequest;
import com.hyperlocalmart.town.entity.AdInvoiceStatus;
import com.hyperlocalmart.town.entity.TownAdSlot;
import com.hyperlocalmart.town.service.AdBillingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AdBillingController {

    private final AdBillingService adBillingService;

    @GetMapping("/api/v1/platform/ads/rates")
    public ResponseEntity<ApiResponse<AdRateCardResponse>> getRates(HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, adBillingService.getRateCard()));
    }

    @PutMapping("/api/v1/platform/ads/rates")
    public ResponseEntity<ApiResponse<AdRateCardResponse>> saveRates(
            @Valid @RequestBody UpsertAdRateCardRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, adBillingService.saveRateCard(request, actorId)));
    }

    @PostMapping("/api/v1/platform/ads/quotes")
    public ResponseEntity<ApiResponse<AdQuoteResponse>> quote(
            @Valid @RequestBody AdQuoteRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, adBillingService.quote(request)));
    }

    @GetMapping("/api/v1/platform/ads/occupancy")
    public ResponseEntity<ApiResponse<AdOccupancyResponse>> occupancy(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID townId,
            @RequestParam(required = false) TownAdSlot slot,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, adBillingService.occupancy(from, to, townId, slot)));
    }

    @GetMapping("/api/v1/platform/ads/invoices")
    public ResponseEntity<ApiResponse<PageResponse<AdInvoiceResponse>>> listInvoices(
            @RequestParam(required = false) AdInvoiceStatus status,
            @RequestParam(required = false) TownAdSlot slot,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                adBillingService.listInvoices(status, slot, q, from, to, page, size)));
    }

    @GetMapping("/api/v1/platform/ads/invoices/{id}")
    public ResponseEntity<ApiResponse<AdInvoiceResponse>> getInvoice(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, adBillingService.getInvoice(id)));
    }

    @PostMapping("/api/v1/platform/ads/invoices")
    public ResponseEntity<ApiResponse<AdInvoiceResponse>> createInvoice(
            @Valid @RequestBody CreateAdInvoiceRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, adBillingService.createInvoice(request, actorId)));
    }

    @PostMapping("/api/v1/platform/ads/invoices/{id}/pay")
    public ResponseEntity<ApiResponse<AdInvoiceResponse>> pay(
            @PathVariable UUID id,
            @Valid @RequestBody PayAdInvoiceRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, adBillingService.markPaid(id, request, actorId)));
    }

    @PostMapping("/api/v1/platform/ads/invoices/{id}/void")
    public ResponseEntity<ApiResponse<AdInvoiceResponse>> voidInvoice(
            @PathVariable UUID id,
            @Valid @RequestBody VoidAdInvoiceRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, adBillingService.voidInvoice(id, request, actorId)));
    }
}
