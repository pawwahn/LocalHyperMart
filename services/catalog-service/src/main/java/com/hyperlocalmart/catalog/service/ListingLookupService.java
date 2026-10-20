package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.dto.response.ListingSnapshotResponse;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ListingLookupService {

    private final VendorListingRepository vendorListingRepository;
    private final CategoryVisibilityService categoryVisibilityService;

    @Transactional(readOnly = true)
    public ListingSnapshotResponse getActiveListing(UUID listingId, UUID townId) {
        return getListing(listingId, townId, true);
    }

    /**
     * Lookup for order/delivery reads — still returns unit even if listing was later deactivated.
     */
    @Transactional(readOnly = true)
    public ListingSnapshotResponse getListingForOrderRead(UUID listingId, UUID townId) {
        return getListing(listingId, townId, false);
    }

    /** Cheapest other active shop in the same town for the same product. Null when none. */
    @Transactional(readOnly = true)
    public ListingSnapshotResponse cheapestAlternate(UUID listingId, UUID townId) {
        VendorListing current;
        try {
            current = vendorListingRepository.findById(listingId).orElse(null);
        } catch (Exception ex) {
            return null;
        }
        if (current == null || current.getMasterItem() == null || !townId.equals(current.getTownId())) {
            return null;
        }
        return vendorListingRepository
                .findActiveSiblings(townId, current.getMasterItem().getId(), listingId)
                .stream()
                .filter(this::canSell)
                .min(Comparator.comparing(ListingPricing::resolveEffectivePrice, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(listing -> {
                    try {
                        return getListing(listing.getId(), townId, true);
                    } catch (BusinessException ex) {
                        return null;
                    }
                })
                .orElse(null);
    }

    private boolean canSell(VendorListing listing) {
        try {
            var category = listing.getMasterItem().getCategory();
            if (category == null || !categoryVisibilityService.isVisibleInTown(category, listing.getTownId())) {
                return false;
            }
            ProductTaxCompliance.validateForSale(listing.getMasterItem());
            return true;
        } catch (BusinessException ex) {
            return false;
        }
    }

    private ListingSnapshotResponse getListing(UUID listingId, UUID townId, boolean requireActive) {
        VendorListing listing = vendorListingRepository.findById(listingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Listing not found"));

        if (!listing.getTownId().equals(townId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Listing does not belong to this town");
        }
        if (requireActive && (!listing.isActive() || listing.getMasterItem().getStatus() != CatalogItemStatus.ACTIVE)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Listing is not available");
        }
        if (requireActive) {
            var category = listing.getMasterItem().getCategory();
            if (category == null || !categoryVisibilityService.isVisibleInTown(category, townId)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Listing is not available");
            }
            ProductTaxCompliance.validateForSale(listing.getMasterItem());
        }

        var master = listing.getMasterItem();
        return ListingSnapshotResponse.builder()
                .listingId(listing.getId())
                .townId(listing.getTownId())
                .vendorId(listing.getVendorId())
                .shopId(listing.getShopId())
                .masterItemId(listing.getMasterItem().getId())
                .name(listing.getMasterItem().getName())
                .unit(listing.getMasterItem().getUnit().getCode())
                .hsnCode(master.getHsnCode())
                .gstPercent(master.getGstPercent())
                .cessPercent(master.getCessPercent())
                .priceIncludesTax(master.isPriceIncludesTax())
                .countryOfOrigin(master.getCountryOfOrigin())
                .price(listing.getPrice())
                .discountPrice(listing.getDiscountPrice())
                .effectivePrice(ListingPricing.resolveEffectivePrice(listing))
                .active(listing.isActive())
                .build();
    }
}
