package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.api.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CatalogBrowseService {

    private final VendorListingRepository vendorListingRepository;
    private final VendorShopClient vendorShopClient;

    @Transactional(readOnly = true)
    public PageResponse<CatalogItemResponse> browse(UUID townId, String query, int page, int size) {
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        PageRequest pageable = PageRequest.of(page, size);
        Page<VendorListing> listings = normalizedQuery == null
                ? vendorListingRepository.findActiveByTown(townId, pageable)
                : vendorListingRepository.searchActiveByTown(townId, normalizedQuery, pageable);

        List<UUID> shopIds = listings.getContent().stream().map(VendorListing::getShopId).distinct().toList();
        Map<UUID, VendorShopClient.ShopInfo> shops = vendorShopClient.getShopsByIds(shopIds);

        List<CatalogItemResponse> items = listings.getContent().stream()
                .filter(listing -> shops.containsKey(listing.getShopId()))
                .map(listing -> toItem(listing, shops.get(listing.getShopId())))
                .toList();

        return PageResponse.<CatalogItemResponse>builder()
                .items(items)
                .page(listings.getNumber())
                .size(listings.getSize())
                .totalElements(listings.getTotalElements())
                .totalPages(listings.getTotalPages())
                .build();
    }

    private CatalogItemResponse toItem(VendorListing listing, VendorShopClient.ShopInfo shop) {
        Instant now = Instant.now();
        BigDecimal mrp = ListingPricing.resolveMrp(listing);
        BigDecimal effectivePrice = ListingPricing.resolveEffectivePrice(listing);
        boolean specialActive = ListingPricing.isSpecialDiscountActive(
                listing.getSpecialDiscountPrice(),
                listing.getSpecialDiscountValidFrom(),
                listing.getSpecialDiscountValidTo(),
                now);

        return CatalogItemResponse.builder()
                .listingId(listing.getId())
                .masterItemId(listing.getMasterItem().getId())
                .name(listing.getMasterItem().getName())
                .unit(listing.getMasterItem().getUnit().getCode())
                .shopName(shop.shopName())
                .vendorId(shop.vendorId())
                .mrp(mrp)
                .price(listing.getPrice())
                .discountPrice(listing.getDiscountPrice())
                .specialDiscountPrice(listing.getSpecialDiscountPrice())
                .effectivePrice(effectivePrice)
                .specialOfferActive(specialActive)
                .vendorNote(listing.getVendorNote())
                .imageUrl(null)
                .build();
    }
}
