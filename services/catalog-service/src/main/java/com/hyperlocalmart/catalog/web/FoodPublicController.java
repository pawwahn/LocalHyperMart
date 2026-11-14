package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.response.FoodMenuResponses;
import com.hyperlocalmart.catalog.service.FoodMenuService;
import com.hyperlocalmart.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/catalog/food")
@RequiredArgsConstructor
public class FoodPublicController {

    private final FoodMenuService foodMenuService;

    @GetMapping("/vendors/{vendorId}/menu")
    public ResponseEntity<ApiResponse<FoodMenuResponses.BuyerFoodMenuResponse>> buyerMenu(
            @PathVariable UUID vendorId,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, foodMenuService.buyerMenu(vendorId, townId)));
    }
}