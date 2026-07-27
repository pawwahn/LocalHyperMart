package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.request.BulkCreateVendorListingsRequest;
import com.hyperlocalmart.catalog.dto.request.CreateMasterItemRequest;
import com.hyperlocalmart.catalog.dto.request.CreateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.request.UpdateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.response.AdminListingResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryResponse;
import com.hyperlocalmart.catalog.dto.response.MasterItemSummaryResponse;
import com.hyperlocalmart.catalog.dto.response.VendorListingResponse;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.Category;
import com.hyperlocalmart.catalog.entity.MasterItem;
import com.hyperlocalmart.catalog.entity.Unit;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.repository.CategoryRepository;
import com.hyperlocalmart.catalog.repository.MasterItemRepository;
import com.hyperlocalmart.catalog.repository.UnitRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorListingService {

    private final VendorListingRepository vendorListingRepository;
    private final MasterItemRepository masterItemRepository;
    private final CategoryRepository categoryRepository;
    private final UnitRepository unitRepository;
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
        return toResponse(createOrUpdateListing(vendorId, actorUserId, context, request), context.shopName());
    }

    @Transactional
    public List<VendorListingResponse> bulkPublish(UUID vendorId, UUID actorUserId, BulkCreateVendorListingsRequest request) {
        VendorShopClient.VendorShopContext context = vendorShopClient.getShopContextForVendor(vendorId);
        List<VendorListingResponse> results = new ArrayList<>();
        for (CreateVendorListingRequest item : request.getItems()) {
            if (item.getActive() == null) {
                item.setActive(true);
            }
            try {
                VendorListing listing = createOrUpdateListing(vendorId, actorUserId, context, item);
                results.add(toResponse(listing, context.shopName()));
            } catch (BusinessException ex) {
                String productName = masterItemRepository.findById(item.getMasterItemId())
                        .map(MasterItem::getName)
                        .orElse("Product");
                throw new BusinessException(ex.getErrorCode(), productName + ": " + ex.getMessage());
            }
        }
        return results;
    }

    @Transactional
    public VendorListingResponse updateListing(UUID vendorId, UUID listingId, UUID actorUserId, UpdateVendorListingRequest request) {
        VendorListing listing = loadVendorListing(vendorId, listingId);
        VendorShopClient.VendorShopContext context = vendorShopClient.getShopContextForVendor(vendorId);

        if (Boolean.TRUE.equals(request.getReplacePricing())) {
            applyPricingReplace(listing, request);
        } else {
            applyPartialPricing(listing, request);
        }

        if (request.getVendorNote() != null) {
            listing.setVendorNote(request.getVendorNote());
        }
        if (request.getActive() != null) {
            listing.setActive(request.getActive());
        }

        validateListingPricing(listing);
        listing.setUpdatedBy(actorUserId);
        return toResponse(vendorListingRepository.save(listing), context.shopName());
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories() {
        return categoryRepository.findByStatusOrderByNameAsc(CatalogItemStatus.ACTIVE).stream()
                .map(this::toCategory)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<MasterItemSummaryResponse> listMasterItems(UUID categoryId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<MasterItem> items = categoryId == null
                ? masterItemRepository.findByStatusOrderByNameAsc(CatalogItemStatus.ACTIVE, pageable)
                : masterItemRepository.findByStatusAndCategoryIdOrderByNameAsc(
                        CatalogItemStatus.ACTIVE, categoryId, pageable);
        List<MasterItemSummaryResponse> summaries = items.getContent().stream()
                .map(this::toMasterSummary)
                .toList();
        return PageResponse.<MasterItemSummaryResponse>builder()
                .items(summaries)
                .page(items.getNumber())
                .size(items.getSize())
                .totalElements(items.getTotalElements())
                .totalPages(items.getTotalPages())
                .build();
    }

    @Transactional
    public MasterItemSummaryResponse createMasterItem(CreateMasterItemRequest request, UUID actorUserId) {
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Category not found"));
        if (category.getStatus() != CatalogItemStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Category is not active");
        }
        Unit unit = unitRepository.findById(request.getUnitId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Unit not found"));
        if (unit.getStatus() != CatalogItemStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unit is not active");
        }

        MasterItem item = MasterItem.builder()
                .category(category)
                .unit(unit)
                .name(request.getName().trim())
                .description(blankToNull(request.getDescription()))
                .mrp(request.getMrp())
                .status(CatalogItemStatus.ACTIVE)
                .build();
        item.setCreatedBy(actorUserId);
        item.setUpdatedBy(actorUserId);
        return toMasterSummary(masterItemRepository.save(item));
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminListingResponse> listAdminListings(
            UUID townId,
            UUID vendorId,
            String shopName,
            Boolean active,
            int page,
            int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<VendorListing> listings = vendorListingRepository.findForAdmin(townId, vendorId, active, pageable);

        List<UUID> shopIds = listings.getContent().stream().map(VendorListing::getShopId).distinct().toList();
        Map<UUID, VendorShopClient.ShopInfo> shops = vendorShopClient.getShopsByIds(shopIds);

        String shopFilter = shopName == null || shopName.isBlank() ? null : shopName.trim().toLowerCase(Locale.ROOT);

        List<AdminListingResponse> items = listings.getContent().stream()
                .map(listing -> {
                    VendorShopClient.ShopInfo shop = shops.get(listing.getShopId());
                    String resolvedShopName = shop != null ? shop.shopName() : "Unknown shop";
                    return toAdminResponse(listing, resolvedShopName);
                })
                .filter(item -> shopFilter == null || item.getShopName().toLowerCase(Locale.ROOT).contains(shopFilter))
                .toList();

        return PageResponse.<AdminListingResponse>builder()
                .items(items)
                .page(listings.getNumber())
                .size(listings.getSize())
                .totalElements(shopFilter == null ? listings.getTotalElements() : items.size())
                .totalPages(listings.getTotalPages())
                .build();
    }

    private VendorListing createOrUpdateListing(
            UUID vendorId,
            UUID actorUserId,
            VendorShopClient.VendorShopContext context,
            CreateVendorListingRequest request) {
        MasterItem masterItem = masterItemRepository.findByIdAndStatus(request.getMasterItemId(), CatalogItemStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Master item not found"));

        BigDecimal vendorMrp = request.getVendorMrp() != null ? request.getVendorMrp() : masterItem.getMrp();
        ListingPricing.validatePricing(
                request.getPrice(),
                vendorMrp,
                request.getDiscountPrice(),
                request.getSpecialDiscountPrice(),
                request.getSpecialDiscountValidFrom(),
                request.getSpecialDiscountValidTo());

        VendorListing listing = vendorListingRepository
                .findByVendorIdAndMasterItemId(vendorId, masterItem.getId())
                .orElse(null);

        if (listing == null) {
            listing = VendorListing.builder()
                    .townId(context.townId())
                    .vendorId(vendorId)
                    .shopId(context.shopId())
                    .masterItem(masterItem)
                    .build();
            listing.setCreatedBy(actorUserId);
        }

        listing.setVendorMrp(vendorMrp);
        listing.setPrice(request.getPrice());
        listing.setDiscountPrice(request.getDiscountPrice());
        listing.setSpecialDiscountPrice(request.getSpecialDiscountPrice());
        listing.setSpecialDiscountValidFrom(request.getSpecialDiscountValidFrom());
        listing.setSpecialDiscountValidTo(request.getSpecialDiscountValidTo());
        listing.setVendorNote(request.getVendorNote());
        listing.setActive(request.getActive() == null || request.getActive());
        listing.setPriceUpdatedAt(Instant.now());
        listing.setUpdatedBy(actorUserId);
        return vendorListingRepository.save(listing);
    }

    private void applyPartialPricing(VendorListing listing, UpdateVendorListingRequest request) {
        boolean pricingChanged = false;
        if (request.getVendorMrp() != null) {
            listing.setVendorMrp(request.getVendorMrp());
            pricingChanged = true;
        }
        if (request.getPrice() != null) {
            listing.setPrice(request.getPrice());
            pricingChanged = true;
        }
        if (request.getDiscountPrice() != null) {
            listing.setDiscountPrice(request.getDiscountPrice());
            pricingChanged = true;
        }
        if (request.getSpecialDiscountPrice() != null) {
            listing.setSpecialDiscountPrice(request.getSpecialDiscountPrice());
            listing.setSpecialDiscountValidFrom(request.getSpecialDiscountValidFrom());
            listing.setSpecialDiscountValidTo(request.getSpecialDiscountValidTo());
            pricingChanged = true;
        }
        if (pricingChanged) {
            listing.setPriceUpdatedAt(Instant.now());
        }
    }

    private void applyPricingReplace(VendorListing listing, UpdateVendorListingRequest request) {
        if (request.getPrice() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Price is required");
        }
        listing.setVendorMrp(request.getVendorMrp());
        listing.setPrice(request.getPrice());
        listing.setDiscountPrice(request.getDiscountPrice());
        listing.setSpecialDiscountPrice(request.getSpecialDiscountPrice());
        listing.setSpecialDiscountValidFrom(request.getSpecialDiscountValidFrom());
        listing.setSpecialDiscountValidTo(request.getSpecialDiscountValidTo());
        listing.setPriceUpdatedAt(Instant.now());
    }

    private void validateListingPricing(VendorListing listing) {
        ListingPricing.validatePricing(
                listing.getPrice(),
                listing.getVendorMrp(),
                listing.getDiscountPrice(),
                listing.getSpecialDiscountPrice(),
                listing.getSpecialDiscountValidFrom(),
                listing.getSpecialDiscountValidTo());
    }

    private VendorListing loadVendorListing(UUID vendorId, UUID listingId) {
        return vendorListingRepository.findByIdAndVendorId(listingId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Listing not found"));
    }

    private CategoryResponse toCategory(Category category) {
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .build();
    }

    private MasterItemSummaryResponse toMasterSummary(MasterItem item) {
        return MasterItemSummaryResponse.builder()
                .masterItemId(item.getId())
                .categoryId(item.getCategory().getId())
                .name(item.getName())
                .unit(item.getUnit().getCode())
                .category(item.getCategory().getName())
                .mrp(item.getMrp())
                .build();
    }

    private AdminListingResponse toAdminResponse(VendorListing listing, String shopName) {
        return AdminListingResponse.builder()
                .listingId(listing.getId())
                .townId(listing.getTownId())
                .vendorId(listing.getVendorId())
                .shopId(listing.getShopId())
                .shopName(shopName)
                .masterItemId(listing.getMasterItem().getId())
                .itemName(listing.getMasterItem().getName())
                .category(listing.getMasterItem().getCategory().getName())
                .unit(listing.getMasterItem().getUnit().getCode())
                .mrp(ListingPricing.resolveMrp(listing))
                .price(listing.getPrice())
                .discountPrice(listing.getDiscountPrice())
                .effectivePrice(ListingPricing.resolveEffectivePrice(listing))
                .vendorNote(listing.getVendorNote())
                .active(listing.isActive())
                .build();
    }

    private VendorListingResponse toResponse(VendorListing listing, String shopName) {
        Instant now = Instant.now();
        BigDecimal mrp = ListingPricing.resolveMrp(listing);
        BigDecimal effectivePrice = ListingPricing.resolveEffectivePrice(listing);
        boolean specialActive = ListingPricing.isSpecialDiscountActive(
                listing.getSpecialDiscountPrice(),
                listing.getSpecialDiscountValidFrom(),
                listing.getSpecialDiscountValidTo(),
                now);

        return VendorListingResponse.builder()
                .listingId(listing.getId())
                .masterItemId(listing.getMasterItem().getId())
                .name(listing.getMasterItem().getName())
                .unit(listing.getMasterItem().getUnit().getCode())
                .townId(listing.getTownId())
                .vendorId(listing.getVendorId())
                .shopId(listing.getShopId())
                .shopName(shopName)
                .masterMrp(listing.getMasterItem().getMrp())
                .vendorMrp(listing.getVendorMrp())
                .mrp(mrp)
                .price(listing.getPrice())
                .discountPrice(listing.getDiscountPrice())
                .specialDiscountPrice(listing.getSpecialDiscountPrice())
                .specialDiscountValidFrom(listing.getSpecialDiscountValidFrom())
                .specialDiscountValidTo(listing.getSpecialDiscountValidTo())
                .specialDiscountActive(specialActive)
                .effectivePrice(effectivePrice)
                .vendorNote(listing.getVendorNote())
                .active(listing.isActive())
                .build();
    }
}
