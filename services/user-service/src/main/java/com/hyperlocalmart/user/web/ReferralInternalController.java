package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.dto.request.ReferralOrderDeliveredRequest;
import com.hyperlocalmart.user.service.ReferralService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ReferralInternalController {

    private final ReferralService referralService;

    @PostMapping("/api/v1/internal/referrals/order-delivered")
    public ResponseEntity<ApiResponse<Void>> orderDelivered(
            @Valid @RequestBody ReferralOrderDeliveredRequest request,
            HttpServletRequest httpRequest) {
        referralService.onOrderDelivered(request.getBuyerId(), request.getOrderId());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, "Referral processed", null));
    }
}
