package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.AdminCodCashHolderLookupRequest;
import com.hyperlocalmart.payment.dto.request.CollectSubscriptionBillRequest;
import com.hyperlocalmart.payment.dto.request.CorrectSubscriptionPaymentRequest;
import com.hyperlocalmart.payment.dto.request.RejectSubscriptionPaymentRequest;
import com.hyperlocalmart.payment.dto.request.SendSubscriptionBillRequest;
import com.hyperlocalmart.payment.dto.request.SubscriptionPaymentRequest;
import com.hyperlocalmart.payment.dto.request.CreateDeliverySettlementRequest;
import com.hyperlocalmart.payment.dto.response.SubscriptionBillView;
import com.hyperlocalmart.payment.dto.request.CorrectVendorPayoutRequest;
import com.hyperlocalmart.payment.dto.request.CreateSettlementRequest;
import com.hyperlocalmart.payment.dto.request.ReportNotReceivedRequest;
import com.hyperlocalmart.payment.dto.request.MarkSettlementPaidRequest;
import com.hyperlocalmart.payment.dto.request.VendorPayoutLookupRequest;
import com.hyperlocalmart.payment.dto.response.AdminOrderSettlementResponse;
import com.hyperlocalmart.payment.dto.response.AgentPaySummaryResponse;
import com.hyperlocalmart.payment.dto.response.DeliverySettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.dto.response.VendorCodCashHolderResponse;
import com.hyperlocalmart.payment.dto.response.VendorOrderPayoutResponse;
import com.hyperlocalmart.payment.dto.response.VendorSettlementAdjustmentResponse;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.AgentPayService;
import com.hyperlocalmart.payment.service.DeliverySettlementService;
import com.hyperlocalmart.payment.service.SettlementService;
import com.hyperlocalmart.payment.service.VendorSettlementAdjustmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/settlements")
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;
    private final DeliverySettlementService deliverySettlementService;
    private final VendorSettlementAdjustmentService vendorSettlementAdjustmentService;
    private final AgentPayService agentPayService;

    @GetMapping("/agent/me")
    public ResponseEntity<ApiResponse<AgentPaySummaryResponse>> agentMe(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                agentPayService.summary(principal.getUserId(), from, to)));
    }

    /** Agent confirms the payout reached them. */
    @PostMapping("/agent/me/payouts/{settlementId}/acknowledge")
    public ResponseEntity<ApiResponse<AgentPaySummaryResponse.Payout>> acknowledgeAgentPayout(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                agentPayService.acknowledge(principal.getUserId(), settlementId)));
    }

    /** Agent says the payout did not arrive, so KoyaKart can correct and send it again. */
    @PostMapping("/agent/me/payouts/{settlementId}/not-received")
    public ResponseEntity<ApiResponse<AgentPaySummaryResponse.Payout>> agentPayoutNotReceived(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody(required = false) ReportNotReceivedRequest request,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        String note = request == null ? null : request.getNote();
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                agentPayService.reportNotReceived(principal.getUserId(), settlementId, note)));
    }

    @GetMapping("/candidates")
    public ResponseEntity<ApiResponse<SettlementCandidateView>> candidates(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam UUID vendorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.listCandidates(townId, vendorId, from, to)));
    }

    @GetMapping("/delivery-candidates")
    public ResponseEntity<ApiResponse<DeliverySettlementCandidateView>> deliveryCandidates(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam SettlementPayeeType payeeType,
            @RequestParam UUID payeeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                deliverySettlementService.listCandidates(townId, payeeType, payeeId, from, to)));
    }

    @PostMapping("/delivery")
    public ResponseEntity<ApiResponse<SettlementResponse>> createDelivery(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateDeliverySettlementRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                deliverySettlementService.create(principal.getUserId(), request)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SettlementResponse>> create(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateSettlementRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                settlementService.create(principal.getUserId(), request)));
    }

    @PostMapping("/{settlementId}/mark-paid")
    public ResponseEntity<ApiResponse<SettlementResponse>> markPaid(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody MarkSettlementPaidRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.markPaid(principal.getUserId(), settlementId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<SettlementResponse>>>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) UUID townId,
            @RequestParam(required = false) SettlementPayeeType payeeType,
            @RequestParam(required = false) UUID payeeId,
            @RequestParam(required = false) SettlementStatus status,
            @RequestHeader(value = "X-Vendor-Id", required = false) UUID vendorIdHeader,
            HttpServletRequest httpRequest) {
        if (isSuperAdmin(principal)) {
            if (payeeType == SettlementPayeeType.HUB) {
                settlementService.ensureHubPayoutInvoices(townId, payeeId);
            }
            return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                    "items", settlementService.list(townId, payeeType, payeeId, status))));
        }
        requireVendor(principal);
        if (vendorIdHeader == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "X-Vendor-Id header required");
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", settlementService.list(
                        townId,
                        SettlementPayeeType.VENDOR,
                        vendorIdHeader,
                        status))));
    }

    @GetMapping("/{settlementId}")
    public ResponseEntity<ApiResponse<SettlementResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @RequestHeader(value = "X-Vendor-Id", required = false) UUID vendorIdHeader,
            HttpServletRequest httpRequest) {
        if (isSuperAdmin(principal)) {
            return ResponseEntity.ok(ApiResponses.ok(httpRequest, settlementService.get(settlementId)));
        }
        requireVendor(principal);
        if (vendorIdHeader == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "X-Vendor-Id header required");
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.getForVendor(vendorIdHeader, settlementId)));
    }

    /** Super admin: monthly subscription bills for a vendor (separate from order-fee collections). */
    @GetMapping("/admin/subscription-bills")
    public ResponseEntity<ApiResponse<Map<String, List<SubscriptionBillView>>>> adminSubscriptionBills(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID vendorId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", settlementService.listSubscriptionBills(vendorId))));
    }

    @PostMapping("/admin/subscription-bills")
    public ResponseEntity<ApiResponse<SettlementResponse>> collectSubscriptionBill(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CollectSubscriptionBillRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                settlementService.collectSubscriptionBill(principal.getUserId(), request)));
    }

    @PostMapping("/admin/subscription-bills/send")
    public ResponseEntity<ApiResponse<SubscriptionBillView>> sendSubscriptionBill(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody SendSubscriptionBillRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                settlementService.sendSubscriptionBill(principal.getUserId(), request)));
    }

    @PostMapping("/admin/subscription-bills/{settlementId}/confirm")
    public ResponseEntity<ApiResponse<SubscriptionBillView>> confirmSubscriptionPayment(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody(required = false) SubscriptionPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.confirmSubscriptionPayment(principal.getUserId(), settlementId, request)));
    }

    @PostMapping("/admin/subscription-bills/{settlementId}/correct")
    public ResponseEntity<ApiResponse<SubscriptionBillView>> correctSubscriptionPayment(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody CorrectSubscriptionPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.correctSubscriptionPayment(principal.getUserId(), settlementId, request)));
    }

    @PostMapping("/admin/subscription-bills/{settlementId}/reject")
    public ResponseEntity<ApiResponse<SubscriptionBillView>> rejectSubscriptionPayment(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody RejectSubscriptionPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.rejectSubscriptionPayment(principal.getUserId(), settlementId, request)));
    }

    @PostMapping("/vendor/me/subscription-bills/{settlementId}/pay")
    public ResponseEntity<ApiResponse<SubscriptionBillView>> paySubscriptionBill(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID settlementId,
            @Valid @RequestBody SubscriptionPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.submitSubscriptionPayment(principal.getUserId(), vendorId, settlementId, request)));
    }

    @GetMapping("/vendor/me/subscription-bills")
    public ResponseEntity<ApiResponse<Map<String, List<SubscriptionBillView>>>> mySubscriptionBills(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", settlementService.listSentSubscriptionBills(vendorId))));
    }

    /** Admin confirms a vendor-reported payment on a bill (shop-cash commission / extra charge). */
    @PostMapping("/admin/vendor-bills/{settlementId}/confirm")
    public ResponseEntity<ApiResponse<SettlementResponse>> confirmVendorBillPayment(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody(required = false) SubscriptionPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.confirmVendorBillPayment(principal.getUserId(), settlementId, request)));
    }

    /** Admin sends the payment back to the vendor with a comment; the vendor corrects and resubmits. */
    @PostMapping("/admin/vendor-bills/{settlementId}/reject")
    public ResponseEntity<ApiResponse<SettlementResponse>> rejectVendorBillPayment(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody RejectSubscriptionPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.rejectVendorBillPayment(principal.getUserId(), settlementId, request)));
    }

    @PostMapping("/vendor/me/bills/{settlementId}/pay")
    public ResponseEntity<ApiResponse<SettlementResponse>> payVendorBill(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID settlementId,
            @Valid @RequestBody SubscriptionPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.submitVendorBillPayment(principal.getUserId(), vendorId, settlementId, request)));
    }

    /** Super admin asks the vendor again to pay a sent shop-fee bill. */
    @PostMapping("/{settlementId}/remind-bill")
    public ResponseEntity<ApiResponse<SettlementResponse>> remindBill(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.remindVendorBill(principal.getUserId(), settlementId)));
    }

    @GetMapping("/vendor/me/bill-reminders")
    public ResponseEntity<ApiResponse<Map<String, List<SettlementResponse>>>> myBillReminders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", settlementService.pendingBillReminders(vendorId))));
    }

    /** Super admin nudges the vendor to confirm receipt; repeatable until acknowledged. */
    @PostMapping("/{settlementId}/remind-ack")
    public ResponseEntity<ApiResponse<SettlementResponse>> remindAck(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.remindVendorAck(principal.getUserId(), settlementId)));
    }

    @GetMapping("/vendor/me/ack-reminders")
    public ResponseEntity<ApiResponse<Map<String, List<SettlementResponse>>>> myAckReminders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", settlementService.pendingAckReminders(vendorId))));
    }

    /** Vendor says the payout has not reached their account. Admin sees "Vendor not received". */
    @PostMapping("/{settlementId}/not-received")
    public ResponseEntity<ApiResponse<SettlementResponse>> notReceived(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody(required = false) ReportNotReceivedRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        String note = request == null ? null : request.getNote();
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.reportNotReceived(principal.getUserId(), vendorId, settlementId, note)));
    }

    /** Super admin corrects mode / UTR / note after the vendor reported the payout missing. */
    @PostMapping("/{settlementId}/correct-payout")
    public ResponseEntity<ApiResponse<SettlementResponse>> correctPayout(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody CorrectVendorPayoutRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.correctVendorPayout(principal.getUserId(), settlementId, request)));
    }

    @PostMapping("/{settlementId}/acknowledge")
    public ResponseEntity<ApiResponse<SettlementResponse>> acknowledge(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.acknowledgeByVendor(principal.getUserId(), vendorId, settlementId)));
    }

    @PostMapping("/vendor/me/lookup")
    public ResponseEntity<ApiResponse<VendorOrderPayoutResponse>> lookupVendorPayouts(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody VendorPayoutLookupRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.lookupVendorPayouts(vendorId, request.getSubOrderIds())));
    }

    /** Super-admin: shop commission collected, or shop share paid, for these orders. */
    @PostMapping("/admin/order-settlements")
    public ResponseEntity<ApiResponse<AdminOrderSettlementResponse>> lookupAdminOrderSettlements(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody AdminCodCashHolderLookupRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.lookupAdminOrderSettlements(request.getOrderIds())));
    }

    /** Super-admin: who holds buyer COD cash for these orders (shop agent, hub agent, hub desk, shop). */
    @PostMapping("/admin/cod-cash-holders")
    public ResponseEntity<ApiResponse<VendorCodCashHolderResponse>> lookupAdminCashHolders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody AdminCodCashHolderLookupRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.lookupAdminCashHolders(request.getOrderIds())));
    }

    /** Who currently holds buyer cash for this vendor's unpaid bags (shop / shop agent / hub desk / hub agent). */
    @PostMapping("/vendor/me/cash-holders")
    public ResponseEntity<ApiResponse<VendorCodCashHolderResponse>> lookupVendorCashHolders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody VendorPayoutLookupRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.lookupVendorCashHolders(vendorId, request.getSubOrderIds())));
    }

    /** Pending + applied claim chargebacks that reduce this vendor's payouts. */
    @GetMapping("/vendor/me/adjustments")
    public ResponseEntity<ApiResponse<Map<String, List<VendorSettlementAdjustmentResponse>>>> listMyAdjustments(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", vendorSettlementAdjustmentService.listForVendor(vendorId))));
    }

    private void requireDeliveryAgent(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null
                || !principal.getRoles().contains("DELIVERY_AGENT")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Delivery agent role required");
        }
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (!isSuperAdmin(principal)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }

    private void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }

    private boolean isSuperAdmin(AuthUserPrincipal principal) {
        return principal != null && principal.getRoles().contains("SUPER_ADMIN");
    }
}
