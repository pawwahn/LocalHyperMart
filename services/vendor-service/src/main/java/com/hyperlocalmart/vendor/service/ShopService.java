package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.client.DeliveryClient;
import com.hyperlocalmart.vendor.dto.request.UpdateShopProfileRequest;
import com.hyperlocalmart.vendor.dto.response.ShopSummaryResponse;
import com.hyperlocalmart.vendor.dto.response.VendorShopContextResponse;
import com.hyperlocalmart.vendor.dto.response.VendorShopStatusResponse;
import com.hyperlocalmart.vendor.entity.Shop;
import com.hyperlocalmart.vendor.entity.ShopStatus;
import com.hyperlocalmart.vendor.entity.VendorStatus;
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

    /** Fallback only when delivery-service hub contacts are unavailable. */
    private static final String FALLBACK_HUB_NAME = "Town Hub";
    private static final String FALLBACK_HUB_PHONE = "9876500100";
    private static final String HUB_HOURS = "10:00 AM – 5:00 PM";

    private final ShopRepository shopRepository;
    private final DeliveryClient deliveryClient;

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
        if (acceptingOrders && shop.getVendor().getStatus() == VendorStatus.DISABLED) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor is disabled — cannot accept orders");
        }
        shop.setAcceptingOrders(acceptingOrders);
        return toStatus(shopRepository.save(shop));
    }

    @Transactional
    public VendorShopStatusResponse updateShopProfile(UUID vendorId, UpdateShopProfileRequest request) {
        Shop shop = requireShopForVendor(vendorId);
        if (shop.getVendor().getStatus() == VendorStatus.DISABLED) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor is disabled");
        }
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
        String hubName = FALLBACK_HUB_NAME;
        String hubPhone = FALLBACK_HUB_PHONE;
        List<DeliveryClient.HubContact> contacts =
                deliveryClient.listHubContactsForTown(shop.getVendor().getTownId());
        if (!contacts.isEmpty()) {
            DeliveryClient.HubContact primary = contacts.getFirst();
            if (primary.hubName() != null && !primary.hubName().isBlank()) {
                hubName = primary.hubName();
            }
            if (primary.phone() != null && !primary.phone().isBlank()) {
                hubPhone = primary.phone();
            }
        }
        return VendorShopStatusResponse.builder()
                .vendorId(shop.getVendor().getId())
                .townId(shop.getVendor().getTownId())
                .shopId(shop.getId())
                .shopName(shop.getShopName())
                .address(shop.getAddress())
                .pincode(shop.getPincode())
                .phone(shop.getVendor().getPhone())
                .acceptingOrders(shop.isAcceptingOrders())
                .hubName(hubName)
                .hubPhone(hubPhone)
                .hubHours(HUB_HOURS)
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
