package com.hyperlocalmart.cart.service;

import com.hyperlocalmart.cart.client.CatalogListingClient;
import com.hyperlocalmart.cart.client.TownConfigClient;
import com.hyperlocalmart.cart.client.VendorShopClient;
import com.hyperlocalmart.cart.dto.request.AddCartItemRequest;
import com.hyperlocalmart.cart.dto.request.ChangeTownRequest;
import com.hyperlocalmart.cart.dto.request.ReorderLineRequest;
import com.hyperlocalmart.cart.dto.request.UpdateCartItemRequest;
import com.hyperlocalmart.cart.dto.response.CartInternalItemResponse;
import com.hyperlocalmart.cart.dto.response.CartInternalResponse;
import com.hyperlocalmart.cart.dto.response.CartItemResponse;
import com.hyperlocalmart.cart.dto.response.CartReorderResponse;
import com.hyperlocalmart.cart.dto.response.CartResponse;
import com.hyperlocalmart.cart.entity.Cart;
import com.hyperlocalmart.cart.entity.CartItem;
import com.hyperlocalmart.cart.entity.CartStatus;
import com.hyperlocalmart.cart.repository.CartItemRepository;
import com.hyperlocalmart.cart.repository.CartRepository;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final CatalogListingClient catalogListingClient;
    private final VendorShopClient vendorShopClient;
    private final TownConfigClient townConfigClient;

    @Transactional(readOnly = true)
    public CartResponse getCart(UUID userId, UUID townId) {
        Cart cart = cartRepository.findByUserIdAndTownIdAndStatus(userId, townId, CartStatus.ACTIVE)
                .orElse(null);
        if (cart == null) {
            return emptyCartResponse(townId);
        }
        return toResponse(cart);
    }

    @Transactional
    public CartResponse addItem(UUID userId, AddCartItemRequest request) {
        ensureNoConflictingTownCart(userId, request.getTownId());
        CatalogListingClient.ListingSnapshot listing =
                catalogListingClient.getListing(request.getListingId(), request.getTownId());

        Cart cart = getOrCreateCart(userId, request.getTownId());
        CartItem existing = cart.getItems().stream()
                .filter(item -> item.getListingId().equals(listing.listingId()))
                .findFirst()
                .orElse(null);

        if (existing != null) {
            existing.setQuantity(existing.getQuantity() + request.getQuantity());
            existing.setLineTotal(calculateLineTotal(existing.getQuantity(), existing.getUnitPrice(), existing.getDiscountPrice()));
        } else {
            CartItem item = CartItem.builder()
                    .cart(cart)
                    .listingId(listing.listingId())
                    .vendorId(listing.vendorId())
                    .masterItemId(listing.masterItemId())
                    .itemName(listing.name())
                    .shopId(listing.shopId())
                    .quantity(request.getQuantity())
                    .unitPrice(listing.price())
                    .discountPrice(listing.discountPrice())
                    .lineTotal(calculateLineTotal(request.getQuantity(), listing.price(), listing.discountPrice()))
                    .build();
            cart.getItems().add(item);
        }

        return toResponse(cartRepository.save(cart));
    }

    @Transactional
    public CartResponse updateItem(UUID userId, UUID itemId, UpdateCartItemRequest request) {
        CartItem item = findUserItem(userId, itemId);
        item.setQuantity(request.getQuantity());
        item.setLineTotal(calculateLineTotal(item.getQuantity(), item.getUnitPrice(), item.getDiscountPrice()));
        return toResponse(item.getCart());
    }

    @Transactional
    public CartResponse removeItem(UUID userId, UUID itemId) {
        CartItem item = findUserItem(userId, itemId);
        Cart cart = item.getCart();
        cart.getItems().remove(item);
        cartItemRepository.delete(item);
        return toResponse(cart);
    }

    @Transactional
    public CartResponse changeTown(UUID userId, ChangeTownRequest request) {
        List<Cart> activeCarts = cartRepository.findByUserIdAndStatus(userId, CartStatus.ACTIVE);
        boolean hasItemsInOtherTown = activeCarts.stream()
                .anyMatch(c -> !c.getTownId().equals(request.getNewTownId()) && !c.getItems().isEmpty());

        if (hasItemsInOtherTown && !request.isConfirmClear()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cart has items in another town. Set confirmClear=true to proceed.");
        }

        for (Cart cart : activeCarts) {
            if (!cart.getTownId().equals(request.getNewTownId())) {
                cart.getItems().clear();
                cart.setStatus(CartStatus.ABANDONED);
                cartRepository.save(cart);
            }
        }

        return getCart(userId, request.getNewTownId());
    }

    @Transactional(readOnly = true)
    public CartInternalResponse getCartForCheckout(UUID userId, UUID cartId, UUID townId) {
        Cart cart = cartRepository.findByIdAndUserIdAndTownIdAndStatus(cartId, userId, townId, CartStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Active cart not found"));
        if (cart.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cart is empty");
        }
        CartResponse response = toResponse(cart);
        if (!response.isMinOrderMet()) {
            throw new BusinessException(ErrorCode.MIN_ORDER_NOT_MET, "Minimum order value not met");
        }
        return toInternalResponse(cart, response);
    }

    @Transactional
    public void convertCart(UUID userId, UUID cartId, UUID townId) {
        Cart cart = cartRepository.findByIdAndUserIdAndTownIdAndStatus(cartId, userId, townId, CartStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Active cart not found"));
        cart.setStatus(CartStatus.CONVERTED);
        cartRepository.save(cart);
    }

    @Transactional
    public CartReorderResponse replaceCartItems(UUID userId, UUID townId, List<ReorderLineRequest> items) {
        ensureNoConflictingTownCart(userId, townId);
        Cart cart = getOrCreateCart(userId, townId);
        cart.getItems().clear();

        for (ReorderLineRequest line : items) {
            CatalogListingClient.ListingSnapshot listing =
                    catalogListingClient.getListing(line.getListingId(), townId);
            CartItem cartItem = CartItem.builder()
                    .cart(cart)
                    .listingId(listing.listingId())
                    .vendorId(listing.vendorId())
                    .masterItemId(listing.masterItemId())
                    .itemName(listing.name())
                    .shopId(listing.shopId())
                    .quantity(line.getQuantity())
                    .unitPrice(listing.price())
                    .discountPrice(listing.discountPrice())
                    .lineTotal(calculateLineTotal(line.getQuantity(), listing.price(), listing.discountPrice()))
                    .build();
            cart.getItems().add(cartItem);
        }

        CartResponse response = toResponse(cartRepository.save(cart));
        return CartReorderResponse.builder()
                .cartId(response.getCartId())
                .townId(response.getTownId())
                .itemsSubtotal(response.getItemsSubtotal())
                .itemCount(response.getItemCount())
                .minOrderMet(response.isMinOrderMet())
                .build();
    }

    private CartInternalResponse toInternalResponse(Cart cart, CartResponse response) {
        List<CartInternalItemResponse> items = cart.getItems().stream()
                .map(item -> {
                    String shopName = response.getItems().stream()
                            .filter(r -> r.getItemId().equals(item.getId()))
                            .map(CartItemResponse::getShopName)
                            .findFirst()
                            .orElse("Local Shop");
                    return CartInternalItemResponse.builder()
                            .itemId(item.getId())
                            .listingId(item.getListingId())
                            .vendorId(item.getVendorId())
                            .shopId(item.getShopId())
                            .masterItemId(item.getMasterItemId())
                            .itemName(item.getItemName())
                            .shopName(shopName)
                            .quantity(item.getQuantity())
                            .unitPrice(item.getUnitPrice())
                            .discountPrice(item.getDiscountPrice())
                            .lineTotal(item.getLineTotal())
                            .build();
                })
                .toList();
        return CartInternalResponse.builder()
                .cartId(cart.getId())
                .userId(cart.getUserId())
                .townId(cart.getTownId())
                .status(cart.getStatus().name())
                .itemsSubtotal(response.getItemsSubtotal())
                .itemCount(response.getItemCount())
                .minOrderMet(response.isMinOrderMet())
                .items(items)
                .build();
    }

    private Cart getOrCreateCart(UUID userId, UUID townId) {
        return cartRepository.findByUserIdAndTownIdAndStatus(userId, townId, CartStatus.ACTIVE)
                .orElseGet(() -> cartRepository.save(Cart.builder()
                        .userId(userId)
                        .townId(townId)
                        .status(CartStatus.ACTIVE)
                        .build()));
    }

    private void ensureNoConflictingTownCart(UUID userId, UUID townId) {
        for (Cart cart : cartRepository.findByUserIdAndStatus(userId, CartStatus.ACTIVE)) {
            if (!cart.getTownId().equals(townId) && !cart.getItems().isEmpty()) {
                throw new BusinessException(ErrorCode.CONFLICT,
                        "Cart has items in another town. Use POST /cart/change-town first.");
            }
        }
    }

    private CartItem findUserItem(UUID userId, UUID itemId) {
        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Cart item not found"));
        if (!item.getCart().getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Cart item not found");
        }
        return item;
    }

    private CartResponse toResponse(Cart cart) {
        List<UUID> shopIds = cart.getItems().stream().map(CartItem::getShopId).distinct().toList();
        Map<UUID, String> shopNames = vendorShopClient.getShopNames(shopIds);
        BigDecimal minOrderValue = townConfigClient.getMinOrderValue(cart.getTownId());

        List<CartItemResponse> items = cart.getItems().stream()
                .map(item -> CartItemResponse.builder()
                        .itemId(item.getId())
                        .listingId(item.getListingId())
                        .name(item.getItemName())
                        .shopName(shopNames.getOrDefault(item.getShopId(), "Local Shop"))
                        .quantity(item.getQuantity())
                        .unitPrice(effectiveUnitPrice(item.getUnitPrice(), item.getDiscountPrice()))
                        .lineTotal(item.getLineTotal())
                        .build())
                .toList();

        BigDecimal subtotal = cart.getItems().stream()
                .map(CartItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int itemCount = cart.getItems().stream().mapToInt(CartItem::getQuantity).sum();

        return CartResponse.builder()
                .cartId(cart.getId())
                .townId(cart.getTownId())
                .itemsSubtotal(subtotal)
                .itemCount(itemCount)
                .items(items)
                .minOrderValue(minOrderValue)
                .minOrderMet(subtotal.compareTo(minOrderValue) >= 0)
                .build();
    }

    private CartResponse emptyCartResponse(UUID townId) {
        BigDecimal minOrderValue = townConfigClient.getMinOrderValue(townId);
        return CartResponse.builder()
                .cartId(null)
                .townId(townId)
                .itemsSubtotal(BigDecimal.ZERO)
                .itemCount(0)
                .items(List.of())
                .minOrderValue(minOrderValue)
                .minOrderMet(false)
                .build();
    }

    private BigDecimal effectiveUnitPrice(BigDecimal unitPrice, BigDecimal discountPrice) {
        return discountPrice != null ? discountPrice : unitPrice;
    }

    private BigDecimal calculateLineTotal(int quantity, BigDecimal unitPrice, BigDecimal discountPrice) {
        return effectiveUnitPrice(unitPrice, discountPrice).multiply(BigDecimal.valueOf(quantity));
    }
}
