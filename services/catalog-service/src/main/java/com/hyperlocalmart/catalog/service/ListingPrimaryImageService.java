package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.dto.response.ListingPrimaryImageResponse;
import com.hyperlocalmart.catalog.entity.MasterItemImage;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.entity.VendorListingImage;
import com.hyperlocalmart.catalog.repository.MasterItemImageRepository;
import com.hyperlocalmart.catalog.repository.VendorListingImageRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ListingPrimaryImageService {

    private final VendorListingRepository vendorListingRepository;
    private final VendorListingImageRepository vendorListingImageRepository;
    private final MasterItemImageRepository masterItemImageRepository;

    @Transactional(readOnly = true)
    public List<ListingPrimaryImageResponse> primaryImages(List<UUID> listingIds) {
        if (listingIds == null || listingIds.isEmpty()) {
            return List.of();
        }
        List<UUID> distinct = listingIds.stream().distinct().limit(48).toList();
        List<VendorListing> listings = vendorListingRepository.findAllById(distinct);
        if (listings.isEmpty()) {
            return List.of();
        }

        List<UUID> resolvedListingIds = listings.stream().map(VendorListing::getId).toList();
        List<UUID> masterIds = listings.stream()
                .map(l -> l.getMasterItem().getId())
                .distinct()
                .toList();

        Map<UUID, List<String>> byListing = new HashMap<>();
        for (VendorListingImage image : vendorListingImageRepository
                .findByListingIdInOrderByListingIdAscSortOrderAsc(resolvedListingIds)) {
            byListing.computeIfAbsent(image.getListingId(), ignored -> new ArrayList<>())
                    .add(image.getPublicUrl());
        }

        Map<UUID, List<String>> byMaster = new HashMap<>();
        for (MasterItemImage image : masterItemImageRepository
                .findByMasterItemIdInOrderByMasterItemIdAscSortOrderAsc(masterIds)) {
            byMaster.computeIfAbsent(image.getMasterItemId(), ignored -> new ArrayList<>())
                    .add(image.getPublicUrl());
        }

        List<ListingPrimaryImageResponse> out = new ArrayList<>();
        for (VendorListing listing : listings) {
            List<String> urls = byListing.getOrDefault(listing.getId(), List.of());
            if (urls.isEmpty()) {
                urls = byMaster.getOrDefault(listing.getMasterItem().getId(), List.of());
            }
            if (urls.isEmpty()) {
                continue;
            }
            out.add(ListingPrimaryImageResponse.builder()
                    .listingId(listing.getId())
                    .imageUrl(urls.get(0))
                    .build());
        }
        return out;
    }
}
