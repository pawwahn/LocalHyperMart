package com.hyperlocalmart.cart.service;

import com.hyperlocalmart.cart.client.CatalogListingClient;
import com.hyperlocalmart.cart.client.TownConfigClient;
import com.hyperlocalmart.cart.client.VendorShopClient;
import com.hyperlocalmart.cart.dto.request.AddCartItemRequest;
import com.hyperlocalmart.cart.dto.response.CartResponse;
import com.hyperlocalmart.cart.entity.Cart;
import com.hyperlocalmart.cart.entity.CartStatus;
import com.hyperlocalmart.cart.repository.CartRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @Mock private CartRepository cartRepository;
    @Mock private com.hyperlocalmart.cart.repository.CartItemRepository cartItemRepository;
    @Mock private CatalogListingClient catalogListingClient;
    @Mock private VendorShopClient vendorShopClient;
    @Mock private TownConfigClient townConfigClient;

    @InjectMocks
    private CartService cartService;

    @Test
    void addItem_createsCartWithLineTotal() {
        UUID userId = UUID.randomUUID();
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");
        UUID listingId = UUID.fromString("01111111-1111-4111-8111-111111111111");
        UUID shopId = UUID.fromString("c1111111-1111-4111-8111-111111111111");

        AddCartItemRequest request = new AddCartItemRequest();
        request.setTownId(townId);
        request.setListingId(listingId);
        request.setQuantity(2);

        when(cartRepository.findByUserIdAndStatus(userId, CartStatus.ACTIVE)).thenReturn(List.of());
        when(cartRepository.findByUserIdAndTownIdAndStatus(userId, townId, CartStatus.ACTIVE)).thenReturn(java.util.Optional.empty());
        when(catalogListingClient.getListing(listingId, townId)).thenReturn(
                new CatalogListingClient.ListingSnapshot(
                        listingId, townId,
                        UUID.fromString("b1111111-1111-4111-8111-111111111111"),
                        shopId,
                        UUID.fromString("f1111111-1111-4111-8111-111111111111"),
                        "Tomato", "KG",
                        new BigDecimal("30.00"), new BigDecimal("28.00"), new BigDecimal("28.00"), true
                )
        );
        when(cartRepository.save(any(Cart.class))).thenAnswer(invocation -> {
            Cart cart = invocation.getArgument(0);
            if (cart.getId() == null) {
                cart.setId(UUID.randomUUID());
            }
            return cart;
        });
        when(vendorShopClient.getShopNames(any())).thenReturn(java.util.Map.of(shopId, "Ravi Kirana"));
        when(townConfigClient.getMinOrderValue(townId)).thenReturn(new BigDecimal("199"));

        CartResponse response = cartService.addItem(userId, request);

        assertThat(response.getItemCount()).isEqualTo(2);
        assertThat(response.getItemsSubtotal()).isEqualByComparingTo("56.00");
        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getShopName()).isEqualTo("Ravi Kirana");
        assertThat(response.isMinOrderMet()).isFalse();
    }

    @Test
    void getCart_returnsEmptyWhenNoCart() {
        UUID userId = UUID.randomUUID();
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");
        when(cartRepository.findByUserIdAndTownIdAndStatus(userId, townId, CartStatus.ACTIVE)).thenReturn(java.util.Optional.empty());
        when(townConfigClient.getMinOrderValue(townId)).thenReturn(new BigDecimal("199"));

        CartResponse response = cartService.getCart(userId, townId);

        assertThat(response.getCartId()).isNull();
        assertThat(response.getItemCount()).isZero();
        assertThat(response.getMinOrderValue()).isEqualByComparingTo("199");
    }
}
