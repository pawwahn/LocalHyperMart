package com.hyperlocalmart.cart.web;

import com.hyperlocalmart.cart.dto.request.ReplaceCartItemsRequest;
import com.hyperlocalmart.cart.dto.response.CartInternalResponse;
import com.hyperlocalmart.cart.dto.response.CartReorderResponse;
import com.hyperlocalmart.cart.service.CartService;
import com.hyperlocalmart.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CartInternalController {

    private final CartService cartService;

    @GetMapping("/api/v1/internal/carts/{cartId}")
    public ResponseEntity<ApiResponse<CartInternalResponse>> getCartForCheckout(
            @PathVariable UUID cartId,
            @RequestParam UUID userId,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                cartService.getCartForCheckout(userId, cartId, townId)));
    }

    @PostMapping("/api/v1/internal/carts/{cartId}/convert")
    public ResponseEntity<Void> convertCart(
            @PathVariable UUID cartId,
            @RequestParam UUID userId,
            @RequestParam UUID townId) {
        cartService.convertCart(userId, cartId, townId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/internal/carts/replace-items")
    public ResponseEntity<ApiResponse<CartReorderResponse>> replaceCartItems(
            @RequestParam UUID userId,
            @RequestParam UUID townId,
            @Valid @RequestBody ReplaceCartItemsRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                cartService.replaceCartItems(userId, townId, request.getItems())));
    }
}
