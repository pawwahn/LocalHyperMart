package com.hyperlocalmart.cart.web;

import com.hyperlocalmart.cart.dto.request.AddCartItemRequest;
import com.hyperlocalmart.cart.dto.request.ApplyPromoRequest;
import com.hyperlocalmart.cart.dto.request.ChangeTownRequest;
import com.hyperlocalmart.cart.dto.request.UpdateCartItemRequest;
import com.hyperlocalmart.cart.dto.response.CartResponse;
import com.hyperlocalmart.cart.security.AuthUserPrincipal;
import com.hyperlocalmart.cart.service.CartService;
import com.hyperlocalmart.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ResponseEntity<ApiResponse<CartResponse>> getCart(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, cartService.getCart(principal.getUserId(), townId)));
    }

    @PostMapping("/items")
    public ResponseEntity<ApiResponse<CartResponse>> addItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody AddCartItemRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, cartService.addItem(principal.getUserId(), request)));
    }

    @PatchMapping("/items/{itemId}")
    public ResponseEntity<ApiResponse<CartResponse>> updateItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpdateCartItemRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, cartService.updateItem(principal.getUserId(), itemId, request)));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<ApiResponse<CartResponse>> removeItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID itemId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, cartService.removeItem(principal.getUserId(), itemId)));
    }

    @PostMapping("/change-town")
    public ResponseEntity<ApiResponse<CartResponse>> changeTown(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody ChangeTownRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, cartService.changeTown(principal.getUserId(), request)));
    }

    @PostMapping("/promo")
    public ResponseEntity<ApiResponse<CartResponse>> applyPromo(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @Valid @RequestBody ApplyPromoRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                cartService.applyPromo(principal.getUserId(), townId, request)));
    }

    @DeleteMapping("/promo")
    public ResponseEntity<ApiResponse<CartResponse>> removePromo(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                cartService.removePromo(principal.getUserId(), townId)));
    }
}
