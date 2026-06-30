package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.response.ShopSummaryResponse;
import com.hyperlocalmart.vendor.dto.response.VendorShopContextResponse;
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

    private final ShopRepository shopRepository;

    @Transactional(readOnly = true)
    public List<ShopSummaryResponse> getShopsByIds(Collection<UUID> shopIds) {
        if (shopIds == null || shopIds.isEmpty()) {
            return List.of();
        }
        return shopRepository.findByIdInAndStatus(shopIds, ShopStatus.ACTIVE).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public VendorShopContextResponse getShopContextForVendor(UUID vendorId) {
        List<Shop> shops = shopRepository.findByVendorIdAndStatus(vendorId, ShopStatus.ACTIVE);
        if (shops.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "No active shop found for vendor");
        }
        Shop shop = shops.getFirst();
        return VendorShopContextResponse.builder()
                .vendorId(vendorId)
                .townId(shop.getVendor().getTownId())
                .shopId(shop.getId())
                .shopName(shop.getShopName())
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
