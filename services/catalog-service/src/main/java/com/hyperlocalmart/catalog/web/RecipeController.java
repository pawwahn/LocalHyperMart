package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.response.RecipeSearchResponse;
import com.hyperlocalmart.catalog.dto.response.RecipeShopPlanResponse;
import com.hyperlocalmart.catalog.service.RecipeService;
import com.hyperlocalmart.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/catalog/recipes")
@RequiredArgsConstructor
@Validated
public class RecipeController {

    private final RecipeService recipeService;

    @GetMapping
    public ResponseEntity<ApiResponse<RecipeSearchResponse>> search(
            @RequestParam(required = false) String q, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, recipeService.search(q)));
    }

    @GetMapping("/{recipeId}")
    public ResponseEntity<ApiResponse<RecipeShopPlanResponse>> plan(
            @PathVariable UUID recipeId,
            @RequestParam @NotNull UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, recipeService.planForTown(recipeId, townId)));
    }
}
