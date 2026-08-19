package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.entity.MasterItemImage;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.entity.VendorListingImage;
import com.hyperlocalmart.catalog.repository.MasterItemImageRepository;
import com.hyperlocalmart.catalog.repository.VendorListingImageRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.api.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CatalogBrowseService {

    private final VendorListingRepository vendorListingRepository;
    private final MasterItemImageRepository masterItemImageRepository;
    private final VendorListingImageRepository vendorListingImageRepository;
    private final VendorShopClient vendorShopClient;

    @Transactional(readOnly = true)
    public PageResponse<CatalogItemResponse> browse(
            UUID townId, UUID categoryId, String query, int page, int size, String sort, String dir) {
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        PageRequest pageable = PageRequest.of(page, size, browseSort(sort, dir));
        Page<VendorListing> listings = normalizedQuery == null
                ? vendorListingRepository.browseActive(townId, categoryId, pageable)
                : vendorListingRepository.searchActive(townId, categoryId, normalizedQuery, pageable);

        List<UUID> shopIds = listings.getContent().stream().map(VendorListing::getShopId).distinct().toList();
        Map<UUID, VendorShopClient.ShopInfo> shops = vendorShopClient.getShopsByIds(shopIds);

        List<UUID> listingIds = listings.getContent().stream().map(VendorListing::getId).toList();
        List<UUID> masterIds = listings.getContent().stream()
                .map(listing -> listing.getMasterItem().getId())
                .distinct()
                .toList();
        Map<UUID, List<String>> imagesByListing = imageUrlsByListing(listingIds);
        Map<UUID, List<String>> imagesByMaster = imageUrlsByMaster(masterIds);

        List<CatalogItemResponse> items = listings.getContent().stream()
                .map(listing -> {
                    List<String> custom = imagesByListing.getOrDefault(listing.getId(), List.of());
                    List<String> master = imagesByMaster.getOrDefault(listing.getMasterItem().getId(), List.of());
                    List<String> effective = custom.isEmpty() ? master : custom;
                    VendorShopClient.ShopInfo shop = shops.get(listing.getShopId());
                    return toItem(listing, shop, effective);
                })
                .toList();

        return PageResponse.<CatalogItemResponse>builder()
                .items(items)
                .page(listings.getNumber())
                .size(listings.getSize())
                .totalElements(listings.getTotalElements())
                .totalPages(listings.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public List<CatalogItemResponse> topDiscountedInTown(UUID townId, Set<UUID> excluded, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        Instant now = Instant.now();
        Collection<UUID> excludedParam = excluded == null || excluded.isEmpty() ? null : excluded;
        Page<VendorListing> page = vendorListingRepository.findDiscountedActiveInTown(
                townId, excludedParam, now, PageRequest.of(0, Math.max(limit * 8, 40)));
        List<VendorListing> sorted = page.getContent().stream()
                .sorted(Comparator.comparingInt(CatalogBrowseService::discountPercent).reversed()
                        .thenComparing(listing -> listing.getMasterItem().getName()))
                .limit(limit)
                .toList();
        return mapListings(sorted);
    }

    @Transactional(readOnly = true)
    public List<CatalogItemResponse> recentlyUpdatedInTown(UUID townId, Set<UUID> excluded, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        Collection<UUID> excludedParam = excluded == null || excluded.isEmpty() ? null : excluded;
        Page<VendorListing> page = vendorListingRepository.findRecentlyUpdatedActiveInTown(
                townId, excludedParam, PageRequest.of(0, limit));
        return mapListings(page.getContent());
    }

    @Transactional(readOnly = true)
    public List<CatalogItemResponse> recentlyAddedInTown(UUID townId, Set<UUID> excluded, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        Collection<UUID> excludedParam = excluded == null || excluded.isEmpty() ? null : excluded;
        Page<VendorListing> page = vendorListingRepository.findRecentlyAddedActiveInTown(
                townId, excludedParam, PageRequest.of(0, limit));
        return mapListings(page.getContent());
    }

    @Transactional(readOnly = true)
    public List<CatalogItemResponse> mapListings(List<VendorListing> listings) {
        if (listings == null || listings.isEmpty()) {
            return List.of();
        }
        List<UUID> shopIds = listings.stream().map(VendorListing::getShopId).distinct().toList();
        Map<UUID, VendorShopClient.ShopInfo> shops = vendorShopClient.getShopsByIds(shopIds);

        List<UUID> listingIds = listings.stream().map(VendorListing::getId).toList();
        List<UUID> masterIds = listings.stream()
                .map(listing -> listing.getMasterItem().getId())
                .distinct()
                .toList();
        Map<UUID, List<String>> imagesByListing = imageUrlsByListing(listingIds);
        Map<UUID, List<String>> imagesByMaster = imageUrlsByMaster(masterIds);

        return listings.stream()
                .map(listing -> {
                    List<String> custom = imagesByListing.getOrDefault(listing.getId(), List.of());
                    List<String> master = imagesByMaster.getOrDefault(listing.getMasterItem().getId(), List.of());
                    List<String> effective = custom.isEmpty() ? master : custom;
                    VendorShopClient.ShopInfo shop = shops.get(listing.getShopId());
                    return toItem(listing, shop, effective);
                })
                .toList();
    }

    static int discountPercent(VendorListing listing) {
        BigDecimal mrp = ListingPricing.resolveMrp(listing);
        BigDecimal effective = ListingPricing.resolveEffectivePrice(listing);
        if (mrp.compareTo(BigDecimal.ZERO) <= 0 || effective.compareTo(mrp) >= 0) {
            return 0;
        }
        return mrp.subtract(effective)
                .multiply(BigDecimal.valueOf(100))
                .divide(mrp, 0, RoundingMode.HALF_UP)
                .intValue();
    }

    private static Sort browseSort(String sort, String dir) {
        String field = switch (sort == null ? "name" : sort.toLowerCase()) {
            case "price" -> "price";
            case "rating" -> "avgRating";
            default -> "masterItem.name";
        };
        Sort.Direction direction = "desc".equalsIgnoreCase(dir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        if ("avgRating".equals(field) && dir == null) {
            direction = Sort.Direction.DESC;
        }
        return Sort.by(direction, field);
    }

    private Map<UUID, List<String>> imageUrlsByListing(List<UUID> listingIds) {
        Map<UUID, List<String>> result = new HashMap<>();
        if (listingIds.isEmpty()) {
            return result;
        }
        for (VendorListingImage image : vendorListingImageRepository
                .findByListingIdInOrderByListingIdAscSortOrderAsc(listingIds)) {
            result.computeIfAbsent(image.getListingId(), ignored -> new ArrayList<>())
                    .add(image.getPublicUrl());
        }
        return result;
    }

    private Map<UUID, List<String>> imageUrlsByMaster(List<UUID> masterIds) {
        Map<UUID, List<String>> result = new HashMap<>();
        if (masterIds.isEmpty()) {
            return result;
        }
        for (MasterItemImage image : masterItemImageRepository.findByMasterItemIdInOrderByMasterItemIdAscSortOrderAsc(masterIds)) {
            result.computeIfAbsent(image.getMasterItemId(), ignored -> new ArrayList<>())
                    .add(image.getPublicUrl());
        }
        return result;
    }

    private CatalogItemResponse toItem(
            VendorListing listing, VendorShopClient.ShopInfo shop, List<String> imageUrls) {
        Instant now = Instant.now();
        BigDecimal mrp = ListingPricing.resolveMrp(listing);
        BigDecimal effectivePrice = ListingPricing.resolveEffectivePrice(listing);
        boolean specialActive = ListingPricing.isSpecialDiscountActive(
                listing.getSpecialDiscountPrice(),
                listing.getSpecialDiscountValidFrom(),
                listing.getSpecialDiscountValidTo(),
                now);
        List<String> urls = imageUrls == null ? List.of() : List.copyOf(imageUrls);
        String primary = urls.isEmpty() ? null : urls.get(0);
        String shopName = shop == null || shop.shopName() == null || shop.shopName().isBlank()
                ? "Local shop"
                : shop.shopName();
        UUID vendorId = shop == null ? listing.getVendorId() : shop.vendorId();

        return CatalogItemResponse.builder()
                .listingId(listing.getId())
                .masterItemId(listing.getMasterItem().getId())
                .categoryId(listing.getMasterItem().getCategory() == null
                        ? null
                        : listing.getMasterItem().getCategory().getId())
                .category(listing.getMasterItem().getCategory() == null
                        ? null
                        : listing.getMasterItem().getCategory().getName())
                .name(listing.getMasterItem().getName())
                .unit(listing.getMasterItem().getUnit().getCode())
                .shopName(shopName)
                .vendorId(vendorId)
                .mrp(mrp)
                .price(listing.getPrice())
                .discountPrice(listing.getDiscountPrice())
                .specialDiscountPrice(listing.getSpecialDiscountPrice())
                .effectivePrice(effectivePrice)
                .specialOfferActive(specialActive)
                .vendorNote(listing.getVendorNote())
                .imageUrl(primary)
                .imageUrls(urls)
                .avgRating(listing.getAvgRating() == null ? BigDecimal.ZERO : listing.getAvgRating())
                .ratingCount(Math.max(0, listing.getRatingCount()))
                .build();
    }
}
