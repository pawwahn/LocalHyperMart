package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.request.CreateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.request.UpdateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.response.MasterItemSummaryResponse;
import com.hyperlocalmart.catalog.dto.response.VendorListingResponse;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.MasterItem;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.repository.MasterItemRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorListingService {

    private final VendorListingRepository vendorListingRepository;
    private final MasterItemRepository masterItemRepository;
    private final VendorShopClient vendorShopClient;

    @Transactional(readOnly = true)
    public PageResponse<VendorListingResponse> listMyListings(UUID vendorId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<VendorListing> listings = vendorListingRepository.findByVendorIdOrderByCreatedAtDesc(vendorId, pageable);
        VendorShopClient.VendorShopContext context = vendorShopClient.getShopContextForVendor(vendorId);
        List<VendorListingResponse> items = listings.getContent().stream()
                .map(listing -> toResponse(listing, context.shopName()))
                .toList();
        return PageResponse.<VendorListingResponse>builder()
                .items(items)
                .page(listings.getNumber())
                .size(listings.getSize())
                .totalElements(listings.getTotalElements())
                .totalPages(listings.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public VendorListingResponse getMyListing(UUID vendorId, UUID listingId) {
        VendorListing listing = loadVendorListing(vendorId, listingId);
        VendorShopClient.VendorShopContext context = vendorShopClient.getShopContextForVendor(vendorId);
        return toResponse(listing, context.shopName());
    }

    @Transactional
    public VendorListingResponse createListing(UUID vendorId, UUID actorUserId, CreateVendorListingRequest request) {
        VendorShopClient.VendorShopContext context = vendorShopClient.getShopContextForVendor(vendorId);
        MasterItem masterItem = masterItemRepository.findByIdAndStatus(request.getMasterItemId(), CatalogItemStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Master item not found"));

        if (vendorListingRepository.existsByVendorIdAndMasterItemId(vendorId, masterItem.getId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Listing already exists for this item");
        }
        if (request.getDiscountPrice() != null && request.getDiscountPrice().compareTo(request.getPrice()) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Discount price cannot exceed price");
        }

        VendorListing listing = VendorListing.builder()
                .townId(context.townId())
                .vendorId(vendorId)
                .shopId(context.shopId())
                .masterItem(masterItem)
                .price(request.getPrice())
                .discountPrice(request.getDiscountPrice())
                .vendorNote(request.getVendorNote())
                .active(request.getActive() == null || request.getActive())
                .priceUpdatedAt(Instant.now())
                .build();
        listing.setCreatedBy(actorUserId);
        listing.setUpdatedBy(actorUserId);
        return toResponse(vendorListingRepository.save(listing), context.shopName());
    }

    @Transactional
    public VendorListingResponse updateListing(UUID vendorId, UUID listingId, UUID actorUserId, UpdateVendorListingRequest request) {
        VendorListing listing = loadVendorListing(vendorId, listingId);
        VendorShopClient.VendorShopContext context = vendorShopClient.getShopContextForVendor(vendorId);

        if (request.getPrice() != null) {
            listing.setPrice(request.getPrice());
            listing.setPriceUpdatedAt(Instant.now());
        }
        if (request.getDiscountPrice() != null) {
            listing.setDiscountPrice(request.getDiscountPrice());
            listing.setPriceUpdatedAt(Instant.now());
        }
        if (request.getVendorNote() != null) {
            listing.setVendorNote(request.getVendorNote());
        }
        if (request.getActive() != null) {
            listing.setActive(request.getActive());
        }

        if (listing.getDiscountPrice() != null && listing.getDiscountPrice().compareTo(listing.getPrice()) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Discount price cannot exceed price");
        }

        listing.setUpdatedBy(actorUserId);
        return toResponse(vendorListingRepository.save(listing), context.shopName());
    }

    @Transactional(readOnly = true)
    public PageResponse<MasterItemSummaryResponse> listMasterItems(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<MasterItem> items = masterItemRepository.findByStatusOrderByNameAsc(CatalogItemStatus.ACTIVE, pageable);
        List<MasterItemSummaryResponse> summaries = items.getContent().stream()
                .map(item -> MasterItemSummaryResponse.builder()
                        .masterItemId(item.getId())
                        .name(item.getName())
                        .unit(item.getUnit().getCode())
                        .category(item.getCategory().getName())
                        .mrp(item.getMrp())
                        .build())
                .toList();
        return PageResponse.<MasterItemSummaryResponse>builder()
                .items(summaries)
                .page(items.getNumber())
                .size(items.getSize())
                .totalElements(items.getTotalElements())
                .totalPages(items.getTotalPages())
                .build();
    }

    private VendorListing loadVendorListing(UUID vendorId, UUID listingId) {
        return vendorListingRepository.findByIdAndVendorId(listingId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Listing not found"));
    }

    private VendorListingResponse toResponse(VendorListing listing, String shopName) {
        return VendorListingResponse.builder()
                .listingId(listing.getId())
                .masterItemId(listing.getMasterItem().getId())
                .name(listing.getMasterItem().getName())
                .unit(listing.getMasterItem().getUnit().getCode())
                .townId(listing.getTownId())
                .vendorId(listing.getVendorId())
                .shopId(listing.getShopId())
                .shopName(shopName)
                .price(listing.getPrice())
                .discountPrice(listing.getDiscountPrice())
                .vendorNote(listing.getVendorNote())
                .active(listing.isActive())
                .build();
    }
}
