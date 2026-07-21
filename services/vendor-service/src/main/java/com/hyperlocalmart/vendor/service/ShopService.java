package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpdateShopProfileRequest;
import com.hyperlocalmart.vendor.dto.response.ShopSummaryResponse;
import com.hyperlocalmart.vendor.dto.response.VendorShopContextResponse;
import com.hyperlocalmart.vendor.dto.response.VendorShopStatusResponse;
import com.hyperlocalmart.vendor.entity.Shop;
import com.hyperlocalmart.vendor.entity.ShopStatus;
import com.hyperlocalmart.vendor.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShopService {

    /** Pilot hub contact (Narsaraopet) — shown in vendor portal Help until multi-hub API exists. */
    private static final String PILOT_HUB_NAME = "Narsaraopet Hub";
    private static final String PILOT_HUB_PHONE = "9876500100";
    private static final String PILOT_HUB_HOURS = "10:00 AM – 5:00 PM";

    private final ShopRepository shopRepository;

    @Transactional(readOnly = true)
    public List<ShopSummaryResponse> getShopsByIds(Collection<UUID> shopIds) {
        if (shopIds == null || shopIds.isEmpty()) {
            return List.of();
        }
        // Only shops that are open for orders appear in town browse / cart enrichment.
        return shopRepository.findByIdInAndStatusAndAcceptingOrdersTrue(shopIds, ShopStatus.ACTIVE).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public VendorShopContextResponse getShopContextForVendor(UUID vendorId) {
        Shop shop = requireShopForVendor(vendorId);
        return VendorShopContextResponse.builder()
                .vendorId(vendorId)
                .townId(shop.getVendor().getTownId())
                .shopId(shop.getId())
                .shopName(shop.getShopName())
                .build();
    }

    @Transactional(readOnly = true)
    public VendorShopStatusResponse getShopStatusForVendor(UUID vendorId) {
        Shop shop = requireShopForVendor(vendorId);
        return toStatus(shop);
    }

    @Transactional
    public VendorShopStatusResponse setAcceptingOrders(UUID vendorId, boolean acceptingOrders) {
        Shop shop = requireShopForVendor(vendorId);
        shop.setAcceptingOrders(acceptingOrders);
        return toStatus(shopRepository.save(shop));
    }

    @Transactional
    public VendorShopStatusResponse updateShopProfile(UUID vendorId, UpdateShopProfileRequest request) {
        Shop shop = requireShopForVendor(vendorId);
        if (request.getShopName() != null && !request.getShopName().isBlank()) {
            shop.setShopName(request.getShopName().trim());
        }
        if (request.getAddress() != null) {
            String address = request.getAddress().trim();
            shop.setAddress(address.isEmpty() ? null : address);
        }
        if (request.getPincode() != null) {
            String pincode = request.getPincode().trim();
            shop.setPincode(pincode.isEmpty() ? null : pincode);
        }
        return toStatus(shopRepository.save(shop));
    }

    private Shop requireShopForVendor(UUID vendorId) {
        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendorId);
        if (shops.isEmpty()) {
            // Fallback for older callers that only looked at ACTIVE shops.
            shops = shopRepository.findByVendorIdAndStatus(vendorId, ShopStatus.ACTIVE);
        }
        if (shops.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "No shop found for vendor");
        }
        return shops.getFirst();
    }

    private VendorShopStatusResponse toStatus(Shop shop) {
        return VendorShopStatusResponse.builder()
                .vendorId(shop.getVendor().getId())
                .townId(shop.getVendor().getTownId())
                .shopId(shop.getId())
                .shopName(shop.getShopName())
                .address(shop.getAddress())
                .pincode(shop.getPincode())
                .phone(shop.getVendor().getPhone())
                .acceptingOrders(shop.isAcceptingOrders())
                .hubName(PILOT_HUB_NAME)
                .hubPhone(PILOT_HUB_PHONE)
                .hubHours(PILOT_HUB_HOURS)
                .build();
    }

    private ShopSummaryResponse toSummary(Shop shop) {
        return ShopSummaryResponse.builder()
                .id(shop.getId())
                .vendorId(shop.getVendor().getId())
                .shopName(shop.getShopName())
                .build();
    }
}
