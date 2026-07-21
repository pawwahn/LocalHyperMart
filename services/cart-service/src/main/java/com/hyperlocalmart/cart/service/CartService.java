package com.hyperlocalmart.cart.service;

import com.hyperlocalmart.cart.client.CatalogListingClient;
import com.hyperlocalmart.cart.client.TownConfigClient;
import com.hyperlocalmart.cart.client.VendorShopClient;
import com.hyperlocalmart.cart.dto.request.AddCartItemRequest;
import com.hyperlocalmart.cart.dto.request.ApplyPromoRequest;
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
import com.hyperlocalmart.cart.entity.DiscountType;
import com.hyperlocalmart.cart.entity.PromoCode;
import com.hyperlocalmart.cart.repository.CartItemRepository;
import com.hyperlocalmart.cart.repository.CartRepository;
import com.hyperlocalmart.cart.repository.PromoCodeRepository;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final PromoCodeRepository promoCodeRepository;
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
            if (existing.getUnitCode() == null || existing.getUnitCode().isBlank()) {
                existing.setUnitCode(listing.unit());
            }
            existing.setLineTotal(calculateLineTotal(existing.getQuantity(), existing.getUnitPrice(), existing.getDiscountPrice()));
        } else {
            BigDecimal cartDiscount = resolveCartDiscountPrice(listing.price(), listing.effectivePrice());
            CartItem item = CartItem.builder()
                    .cart(cart)
                    .listingId(listing.listingId())
                    .vendorId(listing.vendorId())
                    .masterItemId(listing.masterItemId())
                    .itemName(listing.name())
                    .unitCode(listing.unit())
                    .shopId(listing.shopId())
                    .quantity(request.getQuantity())
                    .unitPrice(listing.price())
                    .discountPrice(cartDiscount)
                    .lineTotal(calculateLineTotal(request.getQuantity(), listing.price(), cartDiscount))
                    .build();
            cart.getItems().add(item);
        }

        refreshPromo(cart);
        return toResponse(cartRepository.save(cart));
    }

    @Transactional
    public CartResponse updateItem(UUID userId, UUID itemId, UpdateCartItemRequest request) {
        CartItem item = findUserItem(userId, itemId);
        item.setQuantity(request.getQuantity());
        item.setLineTotal(calculateLineTotal(item.getQuantity(), item.getUnitPrice(), item.getDiscountPrice()));
        refreshPromo(item.getCart());
        return toResponse(item.getCart());
    }

    @Transactional
    public CartResponse removeItem(UUID userId, UUID itemId) {
        CartItem item = findUserItem(userId, itemId);
        Cart cart = item.getCart();
        cart.getItems().remove(item);
        cartItemRepository.delete(item);
        refreshPromo(cart);
        return toResponse(cart);
    }

    @Transactional
    public CartResponse applyPromo(UUID userId, UUID townId, ApplyPromoRequest request) {
        Cart cart = cartRepository.findByUserIdAndTownIdAndStatus(userId, townId, CartStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Add items to cart before applying a coupon"));
        if (cart.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Add items to cart before applying a coupon");
        }

        PromoCode promo = findValidPromo(request.getCode(), itemsSubtotal(cart));
        cart.setPromoCode(promo.getCode());
        cart.setPromoDiscount(computeDiscount(itemsSubtotal(cart), promo));
        return toResponse(cartRepository.save(cart));
    }

    @Transactional
    public CartResponse removePromo(UUID userId, UUID townId) {
        Cart cart = cartRepository.findByUserIdAndTownIdAndStatus(userId, townId, CartStatus.ACTIVE)
                .orElse(null);
        if (cart == null) {
            return emptyCartResponse(townId);
        }
        clearPromo(cart);
        return toResponse(cartRepository.save(cart));
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
                clearPromo(cart);
                cart.setStatus(CartStatus.ABANDONED);
                cartRepository.save(cart);
            }
        }

        return getCart(userId, request.getNewTownId());
    }

    @Transactional
    public CartInternalResponse getCartForCheckout(UUID userId, UUID cartId, UUID townId) {
        Cart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Cart not found"));
        if (!cart.getUserId().equals(userId) || !cart.getTownId().equals(townId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Cart not found");
        }
        if (cart.getStatus() != CartStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cart is not active");
        }
        refreshPromo(cart);
        CartResponse response = toResponse(cart);
        return toInternalResponse(cart, response);
    }

    @Transactional
    public void convertCart(UUID userId, UUID cartId, UUID townId) {
        Cart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Cart not found"));
        if (!cart.getUserId().equals(userId) || !cart.getTownId().equals(townId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Cart not found");
        }
        if (cart.getPromoCode() != null) {
            promoCodeRepository.findByCodeIgnoreCase(cart.getPromoCode()).ifPresent(promo -> {
                promo.setUsedCount(promo.getUsedCount() + 1);
                promoCodeRepository.save(promo);
            });
        }
        cart.setStatus(CartStatus.CONVERTED);
        cartRepository.save(cart);
    }

    @Transactional
    public CartReorderResponse replaceCartItems(UUID userId, UUID townId, List<ReorderLineRequest> lines) {
        Cart cart = getOrCreateCart(userId, townId);
        cart.getItems().clear();
        clearPromo(cart);
        for (ReorderLineRequest line : lines) {
            CatalogListingClient.ListingSnapshot listing =
                    catalogListingClient.getListing(line.getListingId(), townId);
            BigDecimal cartDiscount = resolveCartDiscountPrice(listing.price(), listing.effectivePrice());
            CartItem item = CartItem.builder()
                    .cart(cart)
                    .listingId(listing.listingId())
                    .vendorId(listing.vendorId())
                    .masterItemId(listing.masterItemId())
                    .itemName(listing.name())
                    .unitCode(listing.unit())
                    .shopId(listing.shopId())
                    .quantity(line.getQuantity())
                    .unitPrice(listing.price())
                    .discountPrice(cartDiscount)
                    .lineTotal(calculateLineTotal(line.getQuantity(), listing.price(), cartDiscount))
                    .build();
            cart.getItems().add(item);
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
                            .unitCode(item.getUnitCode())
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
                .promoDiscount(response.getPromoDiscount())
                .promoCode(response.getPromoCode())
                .payableSubtotal(response.getPayableSubtotal())
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
                        .promoDiscount(BigDecimal.ZERO)
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

    private void refreshPromo(Cart cart) {
        if (cart.getPromoCode() == null || cart.getPromoCode().isBlank()) {
            clearPromo(cart);
            return;
        }
        try {
            PromoCode promo = findValidPromo(cart.getPromoCode(), itemsSubtotal(cart));
            cart.setPromoCode(promo.getCode());
            cart.setPromoDiscount(computeDiscount(itemsSubtotal(cart), promo));
        } catch (BusinessException ex) {
            clearPromo(cart);
        }
    }

    private void clearPromo(Cart cart) {
        cart.setPromoCode(null);
        cart.setPromoDiscount(BigDecimal.ZERO);
    }

    private PromoCode findValidPromo(String rawCode, BigDecimal subtotal) {
        String code = normalizeCode(rawCode);
        if (code.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Enter a coupon code");
        }
        PromoCode promo = promoCodeRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid coupon code"));
        if (!promo.isActive()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This coupon is not active");
        }
        if (promo.getExpiresAt() != null && promo.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This coupon has expired");
        }
        if (promo.getUsageLimit() != null && promo.getUsedCount() >= promo.getUsageLimit()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This coupon has reached its usage limit");
        }
        if (subtotal.compareTo(promo.getMinOrderValue()) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Minimum order ₹" + promo.getMinOrderValue().setScale(0, RoundingMode.HALF_UP)
                            + " required for this coupon");
        }
        BigDecimal discount = computeDiscount(subtotal, promo);
        if (discount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This coupon does not apply to your cart");
        }
        return promo;
    }

    private BigDecimal computeDiscount(BigDecimal subtotal, PromoCode promo) {
        if (subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal discount;
        if (promo.getDiscountType() == DiscountType.PERCENT) {
            discount = subtotal.multiply(promo.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            if (promo.getMaxDiscount() != null) {
                discount = discount.min(promo.getMaxDiscount());
            }
        } else {
            discount = promo.getDiscountValue();
        }
        return discount.min(subtotal).setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase().replaceAll("\\s+", "");
    }

    private BigDecimal itemsSubtotal(Cart cart) {
        return cart.getItems().stream()
                .map(CartItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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
                        .unitCode(item.getUnitCode())
                        .quantity(item.getQuantity())
                        .unitPrice(effectiveUnitPrice(item.getUnitPrice(), item.getDiscountPrice()))
                        .lineTotal(item.getLineTotal())
                        .build())
                .toList();

        BigDecimal subtotal = itemsSubtotal(cart);
        BigDecimal promoDiscount = cart.getPromoDiscount() == null ? BigDecimal.ZERO : cart.getPromoDiscount();
        BigDecimal payable = subtotal.subtract(promoDiscount).max(BigDecimal.ZERO);
        int itemCount = cart.getItems().stream().mapToInt(CartItem::getQuantity).sum();

        String promoDescription = null;
        if (cart.getPromoCode() != null) {
            promoDescription = promoCodeRepository.findByCodeIgnoreCase(cart.getPromoCode())
                    .map(PromoCode::getDescription)
                    .orElse(null);
        }

        return CartResponse.builder()
                .cartId(cart.getId())
                .townId(cart.getTownId())
                .itemsSubtotal(subtotal)
                .promoCode(cart.getPromoCode())
                .promoDiscount(promoDiscount)
                .promoDescription(promoDescription)
                .payableSubtotal(payable)
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
                .promoDiscount(BigDecimal.ZERO)
                .promoCode(null)
                .promoDescription(null)
                .payableSubtotal(BigDecimal.ZERO)
                .itemCount(0)
                .items(List.of())
                .minOrderValue(minOrderValue)
                .minOrderMet(false)
                .build();
    }

    private BigDecimal resolveCartDiscountPrice(BigDecimal regularPrice, BigDecimal effectivePrice) {
        if (effectivePrice != null && effectivePrice.compareTo(regularPrice) < 0) {
            return effectivePrice;
        }
        return null;
    }

    private BigDecimal effectiveUnitPrice(BigDecimal unitPrice, BigDecimal discountPrice) {
        return discountPrice != null ? discountPrice : unitPrice;
    }

    private BigDecimal calculateLineTotal(int quantity, BigDecimal unitPrice, BigDecimal discountPrice) {
        return effectiveUnitPrice(unitPrice, discountPrice).multiply(BigDecimal.valueOf(quantity));
    }
}
