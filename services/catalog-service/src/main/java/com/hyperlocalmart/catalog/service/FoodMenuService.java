package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.request.SetVendorListingImagesRequest;
import com.hyperlocalmart.catalog.dto.request.UpsertFoodMenuCategoryRequest;
import com.hyperlocalmart.catalog.dto.request.UpsertFoodMenuItemRequest;
import com.hyperlocalmart.catalog.dto.response.FoodMenuResponses;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.Category;
import com.hyperlocalmart.catalog.entity.FoodMenuCategory;
import com.hyperlocalmart.catalog.entity.FoodMenuItem;
import com.hyperlocalmart.catalog.entity.ListingKind;
import com.hyperlocalmart.catalog.entity.MasterItem;
import com.hyperlocalmart.catalog.entity.Unit;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.entity.VendorListingImage;
import com.hyperlocalmart.catalog.repository.CategoryRepository;
import com.hyperlocalmart.catalog.repository.FoodMenuCategoryRepository;
import com.hyperlocalmart.catalog.repository.FoodMenuItemRepository;
import com.hyperlocalmart.catalog.repository.MasterItemRepository;
import com.hyperlocalmart.catalog.repository.UnitRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.catalog.repository.VendorListingImageRepository;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FoodMenuService {

    static final UUID FOOD_MASTER_CATEGORY_ID = UUID.fromString("f0c00000-0000-4000-8000-000000000099");
    static final UUID PIECE_UNIT_ID = UUID.fromString("e2222222-2222-4222-8222-222222222222");
    private static final String FOOD_HSN = "996331";
    private static final BigDecimal FOOD_GST = new BigDecimal("5.00");

    private final FoodMenuCategoryRepository categoryRepository;
    private final FoodMenuItemRepository itemRepository;
    private final MasterItemRepository masterItemRepository;
    private final CategoryRepository categoryMasterRepository;
    private final UnitRepository unitRepository;
    private final VendorListingRepository vendorListingRepository;
    private final VendorListingImageRepository vendorListingImageRepository;
    private final VendorListingService vendorListingService;
    private final VendorShopClient vendorShopClient;
    private final CatalogBrowseCache catalogBrowseCache;

    @Transactional(readOnly = true)
    public FoodMenuResponses.VendorFoodMenuResponse vendorMenu(UUID vendorId) {
        return buildMenu(vendorId, null);
    }

    @Transactional(readOnly = true)
    public List<FoodMenuResponses.FoodMenuItemPhotoVm> itemPhotos(UUID vendorId, UUID itemId) {
        FoodMenuItem item = loadItem(vendorId, itemId);
        UUID listingId = item.getVendorListingId();
        if (listingId == null) {
            return List.of();
        }
        return listingPhotosByListing(List.of(listingId)).getOrDefault(listingId, List.of());
    }

    @Transactional(readOnly = true)
    public FoodMenuResponses.BuyerFoodMenuResponse buyerMenu(UUID vendorId, UUID townId) {
        VendorShopClient.VendorShopContext ctx = vendorShopClient.getShopContextForVendor(vendorId);
        if (!ctx.townId().equals(townId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This hotel is not in the selected town");
        }
        FoodMenuResponses.VendorFoodMenuResponse menu = buildMenu(vendorId, null);
        return FoodMenuResponses.BuyerFoodMenuResponse.builder()
                .vendorId(vendorId)
                .shopName(ctx.shopName())
                .categories(menu.getCategories())
                .build();
    }

    @Transactional
    public FoodMenuResponses.FoodMenuCategoryVm createCategory(
            UUID vendorId, UUID actorUserId, UpsertFoodMenuCategoryRequest request) {
        String name = request.getName().trim();
        if (categoryRepository.existsByVendorIdAndNameIgnoreCase(vendorId, name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Category already exists: " + name);
        }
        FoodMenuCategory row = FoodMenuCategory.builder()
                .vendorId(vendorId)
                .name(name)
                .sortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder())
                .active(request.getActive() == null || request.getActive())
                .build();
        row.setCreatedBy(actorUserId);
        row.setUpdatedBy(actorUserId);
        categoryRepository.save(row);
        return toCategoryVm(row, List.of(), Map.of());
    }

    @Transactional
    public FoodMenuResponses.FoodMenuCategoryVm updateCategory(
            UUID vendorId, UUID categoryId, UUID actorUserId, UpsertFoodMenuCategoryRequest request) {
        FoodMenuCategory row = loadCategory(vendorId, categoryId);
        String name = request.getName().trim();
        if (!name.equalsIgnoreCase(row.getName()) && categoryRepository.existsByVendorIdAndNameIgnoreCase(vendorId, name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Category already exists: " + name);
        }
        row.setName(name);
        if (request.getSortOrder() != null) {
            row.setSortOrder(request.getSortOrder());
        }
        if (request.getActive() != null) {
            row.setActive(request.getActive());
        }
        row.setUpdatedBy(actorUserId);
        categoryRepository.save(row);
        List<FoodMenuItem> items = itemRepository.findByCategoryIdOrderBySortOrderAscNameAsc(categoryId);
        List<UUID> listingIds = items.stream()
                .map(FoodMenuItem::getVendorListingId)
                .filter(id -> id != null)
                .toList();
        return toCategoryVm(row, items, listingPhotosByListing(listingIds));
    }

    @Transactional
    public void deleteCategory(UUID vendorId, UUID categoryId) {
        FoodMenuCategory row = loadCategory(vendorId, categoryId);
        List<FoodMenuItem> items = itemRepository.findByCategoryIdOrderBySortOrderAscNameAsc(categoryId);
        if (!items.isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Remove all items in this category first");
        }
        categoryRepository.delete(row);
    }

    @Transactional
    public FoodMenuResponses.FoodMenuItemVm createItem(
            UUID vendorId, UUID actorUserId, UpsertFoodMenuItemRequest request) {
        validateItemRequest(request);
        FoodMenuCategory category = loadCategory(vendorId, request.getCategoryId());
        FoodMenuItem item = FoodMenuItem.builder()
                .vendorId(vendorId)
                .categoryId(category.getId())
                .name(request.getName().trim())
                .description(trimOrNull(request.getDescription()))
                .buyerNote(request.getBuyerNote().trim())
                .price(normalizePrice(request.getPrice()))
                .veg(request.getVeg())
                .sortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder())
                .active(request.getActive() == null || request.getActive())
                .build();
        item.setCreatedBy(actorUserId);
        item.setUpdatedBy(actorUserId);
        itemRepository.save(item);
        publishListing(vendorId, actorUserId, item);
        syncItemImages(vendorId, item, request.getImages());
        UUID listingId = item.getVendorListingId();
        return toItemVm(
                item,
                listingId == null ? Map.of() : listingPhotosByListing(List.of(listingId)));
    }

    @Transactional
    public FoodMenuResponses.FoodMenuItemVm updateItem(
            UUID vendorId, UUID itemId, UUID actorUserId, UpsertFoodMenuItemRequest request) {
        validateItemRequest(request);
        FoodMenuItem item = loadItem(vendorId, itemId);
        if (!item.getCategoryId().equals(request.getCategoryId())) {
            loadCategory(vendorId, request.getCategoryId());
            item.setCategoryId(request.getCategoryId());
        }
        item.setName(request.getName().trim());
        item.setDescription(trimOrNull(request.getDescription()));
        item.setBuyerNote(request.getBuyerNote().trim());
        item.setPrice(normalizePrice(request.getPrice()));
        item.setVeg(request.getVeg());
        if (request.getSortOrder() != null) {
            item.setSortOrder(request.getSortOrder());
        }
        if (request.getActive() != null) {
            item.setActive(request.getActive());
        }
        item.setUpdatedBy(actorUserId);
        itemRepository.save(item);
        publishListing(vendorId, actorUserId, item);
        syncItemImages(vendorId, item, request.getImages());
        UUID listingId = item.getVendorListingId();
        return toItemVm(
                item,
                listingId == null ? Map.of() : listingPhotosByListing(List.of(listingId)));
    }

    @Transactional
    public void deleteItem(UUID vendorId, UUID itemId, UUID actorUserId) {
        FoodMenuItem item = loadItem(vendorId, itemId);
        item.setActive(false);
        item.setUpdatedBy(actorUserId);
        itemRepository.save(item);
        if (item.getVendorListingId() != null) {
            vendorListingRepository.findById(item.getVendorListingId()).ifPresent(listing -> {
                listing.setActive(false);
                listing.setUpdatedBy(actorUserId);
                vendorListingRepository.save(listing);
            });
        }
        catalogBrowseCache.evictAll();
    }

    private void publishListing(UUID vendorId, UUID actorUserId, FoodMenuItem item) {
        VendorShopClient.VendorShopContext ctx = vendorShopClient.getShopContextForVendor(vendorId);
        MasterItem master = resolveMasterItem(item, actorUserId);
        item.setMasterItemId(master.getId());

        VendorListing listing = item.getVendorListingId() == null
                ? null
                : vendorListingRepository.findById(item.getVendorListingId()).orElse(null);
        if (listing == null) {
            listing = VendorListing.builder()
                    .townId(ctx.townId())
                    .vendorId(vendorId)
                    .shopId(ctx.shopId())
                    .masterItem(master)
                    .listingKind(ListingKind.FOOD_MENU)
                    .build();
            listing.setCreatedBy(actorUserId);
        }

        master.setName(item.getName().trim());
        master.setDescription(item.getDescription());
        master.setMrp(item.getPrice());
        master.setUpdatedBy(actorUserId);
        masterItemRepository.save(master);

        listing.setMasterItem(master);
        listing.setVendorMrp(item.getPrice());
        listing.setPrice(item.getPrice());
        listing.setDiscountPrice(null);
        listing.setVendorNote(item.getBuyerNote());
        listing.setActive(item.isActive());
        listing.setBuyerOutOfStock(false);
        listing.setListingKind(ListingKind.FOOD_MENU);
        listing.setPriceUpdatedAt(Instant.now());
        listing.setUpdatedBy(actorUserId);
        vendorListingRepository.save(listing);

        item.setVendorListingId(listing.getId());
        itemRepository.save(item);
        catalogBrowseCache.evictAll();
    }

    private void syncItemImages(
            UUID vendorId, FoodMenuItem item, List<SetVendorListingImagesRequest.ImageRef> images) {
        if (images == null) {
            return;
        }
        UUID listingId = item.getVendorListingId();
        if (listingId == null) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "Dish is not linked to a listing yet — check shop setup and save again");
        }
        SetVendorListingImagesRequest imgReq = new SetVendorListingImagesRequest();
        imgReq.setImages(images);
        vendorListingService.setVendorListingImages(vendorId, listingId, imgReq);
    }

    private MasterItem resolveMasterItem(FoodMenuItem item, UUID actorUserId) {
        if (item.getMasterItemId() != null) {
            return masterItemRepository
                    .findById(item.getMasterItemId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Master item missing"));
        }
        Category category = categoryMasterRepository
                .findById(FOOD_MASTER_CATEGORY_ID)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Food catalog bucket missing"));
        Unit unit = unitRepository
                .findById(PIECE_UNIT_ID)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Piece unit missing"));
        MasterItem master = MasterItem.builder()
                .category(category)
                .name(item.getName().trim())
                .description(item.getDescription())
                .unit(unit)
                .mrp(item.getPrice())
                .hsnCode(FOOD_HSN)
                .gstPercent(FOOD_GST)
                .cessPercent(BigDecimal.ZERO)
                .priceIncludesTax(true)
                .countryOfOrigin("IN")
                .status(CatalogItemStatus.ACTIVE)
                .build();
        master.setCreatedBy(actorUserId);
        master.setUpdatedBy(actorUserId);
        ProductTaxCompliance.validateForSale(master);
        return masterItemRepository.save(master);
    }

    private FoodMenuResponses.VendorFoodMenuResponse buildMenu(UUID vendorId, String shopName) {
        List<FoodMenuCategory> categories = categoryRepository.findByVendorIdOrderBySortOrderAscNameAsc(vendorId);
        List<UUID> listingIds = new ArrayList<>();
        for (FoodMenuCategory cat : categories) {
            for (FoodMenuItem item : itemRepository.findByCategoryIdOrderBySortOrderAscNameAsc(cat.getId())) {
                if (item.getVendorListingId() != null) {
                    listingIds.add(item.getVendorListingId());
                }
            }
        }
        Map<UUID, List<FoodMenuResponses.FoodMenuItemPhotoVm>> photosByListing = listingPhotosByListing(listingIds);
        List<FoodMenuResponses.FoodMenuCategoryVm> rows = new ArrayList<>();
        for (FoodMenuCategory cat : categories) {
            List<FoodMenuItem> items = itemRepository.findByCategoryIdOrderBySortOrderAscNameAsc(cat.getId());
            rows.add(toCategoryVm(cat, items, photosByListing));
        }
        return FoodMenuResponses.VendorFoodMenuResponse.builder()
                .vendorId(vendorId)
                .categories(rows)
                .build();
    }

    private static void validateItemRequest(UpsertFoodMenuItemRequest request) {
        if (request.getVeg() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Select Veg or Non-veg");
        }
        if (request.getBuyerNote() == null || request.getBuyerNote().trim().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Customer note is required");
        }
    }

    private FoodMenuCategory loadCategory(UUID vendorId, UUID categoryId) {
        return categoryRepository
                .findByIdAndVendorId(categoryId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Category not found"));
    }

    private FoodMenuItem loadItem(UUID vendorId, UUID itemId) {
        return itemRepository
                .findByIdAndVendorId(itemId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Menu item not found"));
    }

    private static BigDecimal normalizePrice(BigDecimal raw) {
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private static String trimOrNull(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }

    private Map<UUID, List<FoodMenuResponses.FoodMenuItemPhotoVm>> listingPhotosByListing(List<UUID> listingIds) {
        if (listingIds == null || listingIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<FoodMenuResponses.FoodMenuItemPhotoVm>> out = new HashMap<>();
        for (VendorListingImage row : vendorListingImageRepository.findByListingIdInOrderByListingIdAscSortOrderAsc(listingIds)) {
            out.computeIfAbsent(row.getListingId(), ignored -> new ArrayList<>())
                    .add(FoodMenuResponses.FoodMenuItemPhotoVm.builder()
                            .mediaId(row.getMediaId())
                            .url(row.getPublicUrl())
                            .build());
        }
        return out;
    }

    private static FoodMenuResponses.FoodMenuCategoryVm toCategoryVm(
            FoodMenuCategory cat,
            List<FoodMenuItem> items,
            Map<UUID, List<FoodMenuResponses.FoodMenuItemPhotoVm>> photosByListing) {
        List<FoodMenuResponses.FoodMenuItemVm> itemRows =
                items.stream().map(item -> toItemVm(item, photosByListing)).toList();
        return FoodMenuResponses.FoodMenuCategoryVm.builder()
                .id(cat.getId())
                .name(cat.getName())
                .active(cat.isActive())
                .sortOrder(cat.getSortOrder())
                .items(itemRows)
                .build();
    }

    private static FoodMenuResponses.FoodMenuItemVm toItemVm(
            FoodMenuItem item, Map<UUID, List<FoodMenuResponses.FoodMenuItemPhotoVm>> photosByListing) {
        List<FoodMenuResponses.FoodMenuItemPhotoVm> photos = item.getVendorListingId() == null
                ? List.of()
                : photosByListing.getOrDefault(item.getVendorListingId(), List.of());
        List<String> urls = photos.stream().map(FoodMenuResponses.FoodMenuItemPhotoVm::getUrl).toList();
        return FoodMenuResponses.FoodMenuItemVm.builder()
                .id(item.getId())
                .categoryId(item.getCategoryId())
                .name(item.getName())
                .description(item.getDescription())
                .buyerNote(item.getBuyerNote())
                .price(item.getPrice())
                .veg(item.isVeg())
                .active(item.isActive())
                .sortOrder(item.getSortOrder())
                .listingId(item.getVendorListingId())
                .photos(photos)
                .imageUrls(urls)
                .build();
    }
}