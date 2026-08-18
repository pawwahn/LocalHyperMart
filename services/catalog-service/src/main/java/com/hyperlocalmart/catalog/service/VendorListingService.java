package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.request.BulkCreateVendorListingsRequest;
import com.hyperlocalmart.catalog.dto.request.CreateCategoryRequest;
import com.hyperlocalmart.catalog.dto.request.CreateMasterItemRequest;
import com.hyperlocalmart.catalog.dto.request.CreateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.request.SetMasterItemImagesRequest;
import com.hyperlocalmart.catalog.dto.request.SetVendorListingImagesRequest;
import com.hyperlocalmart.catalog.dto.request.UpdateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.response.AdminListingResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryResponse;
import com.hyperlocalmart.catalog.dto.response.UnitResponse;
import com.hyperlocalmart.catalog.dto.response.MasterItemSummaryResponse;
import com.hyperlocalmart.catalog.dto.response.VendorListingResponse;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.Category;
import com.hyperlocalmart.catalog.entity.MasterItem;
import com.hyperlocalmart.catalog.entity.MasterItemImage;
import com.hyperlocalmart.catalog.entity.Unit;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.entity.VendorListingImage;
import com.hyperlocalmart.catalog.repository.CategoryRepository;
import com.hyperlocalmart.catalog.repository.MasterItemImageRepository;
import com.hyperlocalmart.catalog.repository.MasterItemRepository;
import com.hyperlocalmart.catalog.repository.UnitRepository;
import com.hyperlocalmart.catalog.repository.VendorListingImageRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorListingService {

    private final VendorListingRepository vendorListingRepository;
    private final MasterItemRepository masterItemRepository;
    private final MasterItemImageRepository masterItemImageRepository;
    private final VendorListingImageRepository vendorListingImageRepository;
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
        attachListingImages(items);
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
        VendorListingResponse response = toResponse(listing, context.shopName());
        attachListingImages(List.of(response));
        return response;
    }

    @Transactional
    public VendorListingResponse createListing(UUID vendorId, UUID actorUserId, CreateVendorListingRequest request) {
        VendorShopClient.VendorShopContext context = vendorShopClient.getShopContextForVendor(vendorId);
        VendorListingResponse response = toResponse(
                createOrUpdateListing(vendorId, actorUserId, context, request), context.shopName());
        attachListingImages(List.of(response));
        return response;
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
        attachListingImages(results);
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
        VendorListingResponse response = toResponse(vendorListingRepository.save(listing), context.shopName());
        attachListingImages(List.of(response));
        return response;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories() {
        return categoryRepository.findByStatusOrderByNameAsc(CatalogItemStatus.ACTIVE).stream()
                .map(this::toCategory)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UnitResponse> listUnits() {
        return unitRepository.findByStatusOrderByCodeAsc(CatalogItemStatus.ACTIVE).stream()
                .map(this::toUnit)
                .toList();
    }

    @Transactional
    public CategoryResponse createCategory(CreateCategoryRequest request, UUID actorUserId) {
        String name = normalizeCategoryName(request.getName());
        if (name.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Category name is required");
        }
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Category “" + name + "” already exists");
        }
        Category category = Category.builder()
                .name(name)
                .description(request.getDescription() == null || request.getDescription().isBlank()
                        ? null
                        : request.getDescription().trim())
                .status(CatalogItemStatus.ACTIVE)
                .build();
        category.setCreatedBy(actorUserId);
        category.setUpdatedBy(actorUserId);
        return toCategory(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(UUID categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Category not found"));
        long itemCount = masterItemRepository.countByCategory_Id(categoryId);
        if (itemCount > 0) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "Cannot delete “" + category.getName() + "” — " + itemCount
                            + (itemCount == 1 ? " item uses" : " items use")
                            + " this category. Move or delete those items first.");
        }
        categoryRepository.delete(category);
    }

    @Transactional
    public CategoryResponse updateCategory(UUID categoryId, CreateCategoryRequest request, UUID actorUserId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Category not found"));
        String name = normalizeCategoryName(request.getName());
        if (name.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Category name is required");
        }
        if (categoryRepository.existsByNameIgnoreCaseAndIdNot(name, categoryId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Category “" + name + "” already exists");
        }
        category.setName(name);
        category.setDescription(request.getDescription() == null || request.getDescription().isBlank()
                ? null
                : request.getDescription().trim());
        category.setUpdatedBy(actorUserId);
        return toCategory(categoryRepository.save(category));
    }

    static String normalizeCategoryName(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().replaceAll("\\s+", " ");
    }

    @Transactional(readOnly = true)
    public PageResponse<MasterItemSummaryResponse> listMasterItems(
            UUID categoryId, UUID unitId, String q, int page, int size, String sort, String dir) {
        PageRequest pageable = PageRequest.of(page, size, masterItemSort(sort, dir));
        String query = q == null ? "" : q.trim();
        Page<MasterItem> items = masterItemRepository.searchActive(
                CatalogItemStatus.ACTIVE, categoryId, unitId, query, pageable);
        List<MasterItemSummaryResponse> summaries = items.getContent().stream()
                .map(this::toMasterSummary)
                .toList();
        attachImageUrls(summaries);
        return PageResponse.<MasterItemSummaryResponse>builder()
                .items(summaries)
                .page(items.getNumber())
                .size(items.getSize())
                .totalElements(items.getTotalElements())
                .totalPages(items.getTotalPages())
                .build();
    }

    private static Sort masterItemSort(String sort, String dir) {
        String field = switch (sort == null ? "name" : sort.toLowerCase(Locale.ROOT)) {
            case "mrp" -> "mrp";
            case "category" -> "category.name";
            case "unit" -> "unit.code";
            default -> "name";
        };
        Sort.Direction direction = "desc".equalsIgnoreCase(dir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(direction, field);
    }

    @Transactional(readOnly = true)
    public List<String> listMasterItemImageUrls(UUID masterItemId) {
        return masterItemImageRepository.findByMasterItemIdOrderBySortOrderAsc(masterItemId).stream()
                .map(MasterItemImage::getPublicUrl)
                .toList();
    }

    @Transactional
    public List<String> setMasterItemImages(UUID masterItemId, SetMasterItemImagesRequest request) {
        MasterItem item = masterItemRepository.findById(masterItemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Master item not found"));
        if (item.getStatus() != CatalogItemStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Master item is not active");
        }
        List<SetMasterItemImagesRequest.ImageRef> refs = request.getImages() == null
                ? List.of()
                : request.getImages();
        if (refs.size() > 3) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At most 3 images allowed");
        }
        masterItemImageRepository.deleteByMasterItemId(masterItemId);
        masterItemImageRepository.flush();
        short order = 0;
        for (SetMasterItemImagesRequest.ImageRef ref : refs) {
            String url = ref.getUrl().trim();
            if (url.isEmpty()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Image URL is required");
            }
            masterItemImageRepository.save(MasterItemImage.builder()
                    .masterItemId(masterItemId)
                    .mediaId(ref.getMediaId())
                    .publicUrl(url)
                    .sortOrder(order++)
                    .build());
        }
        if (!refs.isEmpty()) {
            masterItemRepository.save(item);
        }
        return listMasterItemImageUrls(masterItemId);
    }

    @Transactional(readOnly = true)
    public List<String> listVendorListingImageUrls(UUID vendorId, UUID listingId) {
        loadVendorListing(vendorId, listingId);
        return vendorListingImageRepository.findByListingIdOrderBySortOrderAsc(listingId).stream()
                .map(VendorListingImage::getPublicUrl)
                .toList();
    }

    @Transactional
    public List<String> setVendorListingImages(
            UUID vendorId, UUID listingId, SetVendorListingImagesRequest request) {
        loadVendorListing(vendorId, listingId);
        List<SetVendorListingImagesRequest.ImageRef> refs = request.getImages() == null
                ? List.of()
                : request.getImages();
        if (refs.size() > 3) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At most 3 images allowed");
        }
        vendorListingImageRepository.deleteByListingId(listingId);
        vendorListingImageRepository.flush();
        short order = 0;
        for (SetVendorListingImagesRequest.ImageRef ref : refs) {
            if (ref.getMediaId() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Image mediaId is required");
            }
            if (ref.getUrl() == null || ref.getUrl().isBlank()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Image URL is required");
            }
            String url = ref.getUrl().trim();
            vendorListingImageRepository.save(VendorListingImage.builder()
                    .listingId(listingId)
                    .mediaId(ref.getMediaId())
                    .publicUrl(url)
                    .sortOrder(order++)
                    .build());
        }
        return listVendorListingImageUrls(vendorId, listingId);
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
        MasterItemSummaryResponse created = toMasterSummary(masterItemRepository.save(item));
        created.setImageUrls(List.of());
        return created;
    }

    @Transactional
    public MasterItemSummaryResponse updateMasterItem(
            UUID masterItemId, CreateMasterItemRequest request, UUID actorUserId) {
        MasterItem item = masterItemRepository.findById(masterItemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Master item not found"));
        if (item.getStatus() != CatalogItemStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Master item is not active");
        }
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
        item.setCategory(category);
        item.setUnit(unit);
        item.setName(request.getName().trim());
        item.setDescription(blankToNull(request.getDescription()));
        item.setMrp(request.getMrp());
        item.setUpdatedBy(actorUserId);
        MasterItemSummaryResponse updated = toMasterSummary(masterItemRepository.save(item));
        attachImageUrls(List.of(updated));
        return updated;
    }

    @Transactional
    public void deleteMasterItem(UUID masterItemId) {
        MasterItem item = masterItemRepository.findById(masterItemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Master item not found"));
        long listingCount = vendorListingRepository.countByMasterItem_Id(masterItemId);
        if (listingCount > 0) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "Cannot delete “" + item.getName() + "” — " + listingCount
                            + (listingCount == 1 ? " vendor listing uses" : " vendor listings use")
                            + " this item. Remove those listings first.");
        }
        masterItemImageRepository.deleteByMasterItemId(masterItemId);
        masterItemRepository.delete(item);
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

    private UnitResponse toUnit(Unit unit) {
        return UnitResponse.builder()
                .id(unit.getId())
                .code(unit.getCode())
                .label(unit.getLabel())
                .displayName(unit.getLabel())
                .build();
    }

    private MasterItemSummaryResponse toMasterSummary(MasterItem item) {
        return MasterItemSummaryResponse.builder()
                .masterItemId(item.getId())
                .categoryId(item.getCategory().getId())
                .unitId(item.getUnit().getId())
                .name(item.getName())
                .unit(item.getUnit().getCode())
                .category(item.getCategory().getName())
                .mrp(item.getMrp())
                .imageUrls(List.of())
                .build();
    }

    private void attachImageUrls(List<MasterItemSummaryResponse> summaries) {
        if (summaries.isEmpty()) {
            return;
        }
        List<UUID> ids = summaries.stream().map(MasterItemSummaryResponse::getMasterItemId).toList();
        Map<UUID, List<String>> byMaster = new HashMap<>();
        for (MasterItemImage image : masterItemImageRepository.findByMasterItemIdInOrderByMasterItemIdAscSortOrderAsc(ids)) {
            byMaster.computeIfAbsent(image.getMasterItemId(), ignored -> new ArrayList<>()).add(image.getPublicUrl());
        }
        for (MasterItemSummaryResponse summary : summaries) {
            summary.setImageUrls(byMaster.getOrDefault(summary.getMasterItemId(), List.of()));
        }
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
                .imageUrls(List.of())
                .listingImageUrls(List.of())
                .masterImageUrls(List.of())
                .customImages(false)
                .build();
    }

    private void attachListingImages(List<VendorListingResponse> responses) {
        if (responses.isEmpty()) {
            return;
        }
        List<UUID> listingIds = responses.stream().map(VendorListingResponse::getListingId).toList();
        List<UUID> masterIds = responses.stream().map(VendorListingResponse::getMasterItemId).distinct().toList();

        Map<UUID, List<String>> listingImages = new HashMap<>();
        for (VendorListingImage image : vendorListingImageRepository
                .findByListingIdInOrderByListingIdAscSortOrderAsc(listingIds)) {
            listingImages.computeIfAbsent(image.getListingId(), ignored -> new ArrayList<>())
                    .add(image.getPublicUrl());
        }

        Map<UUID, List<String>> masterImages = new HashMap<>();
        for (MasterItemImage image : masterItemImageRepository
                .findByMasterItemIdInOrderByMasterItemIdAscSortOrderAsc(masterIds)) {
            masterImages.computeIfAbsent(image.getMasterItemId(), ignored -> new ArrayList<>())
                    .add(image.getPublicUrl());
        }

        for (VendorListingResponse response : responses) {
            List<String> custom = listingImages.getOrDefault(response.getListingId(), List.of());
            List<String> master = masterImages.getOrDefault(response.getMasterItemId(), List.of());
            response.setListingImageUrls(custom);
            response.setMasterImageUrls(master);
            response.setCustomImages(!custom.isEmpty());
            response.setImageUrls(custom.isEmpty() ? master : custom);
        }
    }
}
