package com.hyperlocalmart.cart.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CartSuggestionsResponse {

    private List<CartSuggestionItemResponse> items;

    public static CartSuggestionsResponse empty() {
        return CartSuggestionsResponse.builder().items(List.of()).build();
    }
}
