package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.vendor.dto.request.UpsertFoodHotelPhotosRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertFoodProfileRequest;
import com.hyperlocalmart.vendor.dto.response.FoodHotelCardResponse;
import com.hyperlocalmart.vendor.dto.response.FoodProfileResponse;
import com.hyperlocalmart.vendor.food.FoodHotelPhotos;
import com.hyperlocalmart.vendor.entity.FoodProfile;
import com.hyperlocalmart.vendor.entity.ServiceOffering;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.entity.VendorStatus;
import com.hyperlocalmart.vendor.repository.FoodProfileRepository;
import com.hyperlocalmart.vendor.repository.ServiceOfferingRepository;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FoodVendorService {

    static final UUID FOOD_SERVICE_ID = UUID.fromString("a5555555-5555-4555-8555-555555555555");

    private final VendorRepository vendorRepository;
    private final FoodProfileRepository foodProfileRepository;
    private final ServiceOfferingRepository offeringRepository;
    private final ShopService shopService;

    @Transactional(readOnly = true)
    public List<FoodHotelCardResponse> listForTown(UUID townId, boolean bookableOnly) {
        List<Vendor> vendors = vendorRepository.findByTownIdAndStatusOrderByCreatedAtDesc(townId, VendorStatus.ACTIVE);
        if (vendors.isEmpty()) {
            return List.of();
        }
        Map<UUID, ServiceOffering> offerings = offeringRepository.findAll().stream()
                .collect(Collectors.toMap(ServiceOffering::getId, Function.identity()));
        List<UUID> foodVendorIds = vendors.stream()
                .filter(v -> isFoodVendor(v, offerings))
                .map(Vendor::getId)
                .toList();
        Map<UUID, FoodProfile> profiles = (bookableOnly
                        ? foodProfileRepository.findByVendorIdInAndEnabledTrue(foodVendorIds)
                        : foodProfileRepository.findByVendorIdIn(foodVendorIds))
                .stream()
                .collect(Collectors.toMap(FoodProfile::getVendorId, Function.identity(), (a, b) -> a));
        Map<UUID, Boolean> shopOpen = shopService.vendorShopOpenForCustomers(foodVendorIds);
        List<FoodHotelCardResponse> out = new ArrayList<>();
        for (Vendor vendor : vendors) {
            if (!isFoodVendor(vendor, offerings)) {
                continue;
            }
            FoodProfile profile = profiles.get(vendor.getId());
            if (bookableOnly) {
                if (profile == null || !profile.isEnabled()) {
                    continue;
                }
                if (!shopOpen.getOrDefault(vendor.getId(), true)) {
                    continue;
                }
                if (!profile.isAcceptingOrders()) {
                    continue;
                }
            } else if (profile == null) {
                profile = defaultProfile(vendor.getId());
            }
            out.add(toCard(vendor, shopDisplayName(vendor), profile));
        }
        out.sort(Comparator.comparing(FoodHotelCardResponse::getBusinessName, String.CASE_INSENSITIVE_ORDER));
        return out;
    }

    @Transactional(readOnly = true)
    public FoodProfileResponse profileForVendor(UUID vendorId) {
        requireFoodVendor(vendorId);
        FoodProfile row = foodProfileRepository.findById(vendorId).orElse(defaultProfile(vendorId));
        return toProfileResponse(row);
    }

    @Transactional
    public FoodProfileResponse upsertProfile(UUID vendorId, UUID actorUserId, UpsertFoodProfileRequest request) {
        requireFoodVendor(vendorId);
        FoodProfile row = foodProfileRepository.findById(vendorId).orElse(FoodProfile.builder().vendorId(vendorId).build());
        if (request.getEnabled() != null) {
            row.setEnabled(request.getEnabled());
        }
        if (request.getTagline() != null) {
            row.setTagline(request.getTagline().trim());
        }
        if (request.getCuisines() != null) {
            row.setCuisines(request.getCuisines().trim());
        }
        if (request.getPureVeg() != null) {
            row.setPureVeg(request.getPureVeg());
        }
        if (request.getOpensAtLabel() != null) {
            row.setOpensAtLabel(request.getOpensAtLabel().trim());
        }
        if (request.getPriceForOne() != null) {
            row.setPriceForOne(request.getPriceForOne());
        }
        if (request.getOfferLabel() != null) {
            row.setOfferLabel(request.getOfferLabel().trim());
        }
        if (request.getAcceptingOrders() != null) {
            row.setAcceptingOrders(request.getAcceptingOrders());
        }
        if (request.getHotelPhotoMediaIds() != null) {
            List<UUID> normalized = FoodHotelPhotos.normalize(request.getHotelPhotoMediaIds());
            row.setHotelPhotoMediaIds(FoodHotelPhotos.serialize(normalized));
        }
        row.setUpdatedBy(actorUserId);
        if (row.getCreatedBy() == null) {
            row.setCreatedBy(actorUserId);
        }
        return toProfileResponse(foodProfileRepository.save(row));
    }

    @Transactional
    public FoodProfileResponse upsertHotelPhotos(UUID vendorId, UUID actorUserId, UpsertFoodHotelPhotosRequest request) {
        requireFoodVendor(vendorId);
        FoodProfile row = foodProfileRepository.findById(vendorId).orElse(FoodProfile.builder().vendorId(vendorId).build());
        List<UUID> normalized = FoodHotelPhotos.normalize(request.getMediaIds());
        row.setHotelPhotoMediaIds(FoodHotelPhotos.serialize(normalized));
        row.setUpdatedBy(actorUserId);
        if (row.getCreatedBy() == null) {
            row.setCreatedBy(actorUserId);
        }
        return toProfileResponse(foodProfileRepository.save(row));
    }

    @Transactional(readOnly = true)
    public FoodHotelCardResponse getBookableHotel(UUID vendorId) {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        Map<UUID, ServiceOffering> offerings = offeringRepository.findAll().stream()
                .collect(Collectors.toMap(ServiceOffering::getId, Function.identity()));
        if (!isFoodVendor(vendor, offerings)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Not a food delivery hotel");
        }
        FoodProfile profile = foodProfileRepository.findById(vendorId).orElse(null);
        if (profile == null || !profile.isEnabled() || !profile.isAcceptingOrders()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This hotel is not taking orders");
        }
        if (!shopService.isVendorShopOpenForCustomers(vendorId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "This hotel is paused — orders are not available right now");
        }
        return toCard(vendor, shopDisplayName(vendor), profile);
    }

    private String shopDisplayName(Vendor vendor) {
        try {
            return shopService.getShopContextForVendor(vendor.getId()).getShopName();
        } catch (BusinessException ex) {
            return vendor.getBusinessName();
        }
    }

    private void requireFoodVendor(UUID vendorId) {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        Map<UUID, ServiceOffering> offerings = offeringRepository.findAll().stream()
                .collect(Collectors.toMap(ServiceOffering::getId, Function.identity()));
        if (!isFoodVendor(vendor, offerings)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This vendor is not registered for food delivery");
        }
    }

    private static boolean isFoodVendor(Vendor vendor, Map<UUID, ServiceOffering> offerings) {
        if (vendor.getServiceId() == null) {
            return false;
        }
        if (FOOD_SERVICE_ID.equals(vendor.getServiceId())) {
            return true;
        }
        ServiceOffering offering = offerings.get(vendor.getServiceId());
        return CatalogListingPolicy.isFoodDeliveryService(offering == null ? null : offering.getName());
    }

    private static FoodProfile defaultProfile(UUID vendorId) {
        return FoodProfile.builder()
                .vendorId(vendorId)
                .enabled(false)
                .ratingScore(BigDecimal.ZERO)
                .ratingCount(0)
                .build();
    }

    private static FoodHotelCardResponse toCard(Vendor vendor, String shopName, FoodProfile profile) {
        return FoodHotelCardResponse.builder()
                .vendorId(vendor.getId())
                .businessName(vendor.getBusinessName())
                .shopName(shopName)
                .tagline(profile.getTagline())
                .cuisines(profile.getCuisines())
                .pureVeg(profile.isPureVeg())
                .opensAtLabel(profile.getOpensAtLabel())
                .priceForOne(profile.getPriceForOne())
                .offerLabel(profile.getOfferLabel())
                .ratingScore(profile.getRatingScore())
                .ratingCount(profile.getRatingCount())
                .acceptingOrders(profile.isAcceptingOrders())
                .hotelPhotos(FoodHotelPhotos.toRows(profile.getHotelPhotoMediaIds()))
                .build();
    }

    private static FoodProfileResponse toProfileResponse(FoodProfile profile) {
        return FoodProfileResponse.builder()
                .vendorId(profile.getVendorId())
                .enabled(profile.isEnabled())
                .tagline(profile.getTagline())
                .cuisines(profile.getCuisines())
                .pureVeg(profile.isPureVeg())
                .opensAtLabel(profile.getOpensAtLabel())
                .priceForOne(profile.getPriceForOne())
                .offerLabel(profile.getOfferLabel())
                .ratingScore(profile.getRatingScore())
                .ratingCount(profile.getRatingCount())
                .acceptingOrders(profile.isAcceptingOrders())
                .hotelPhotos(FoodHotelPhotos.toRows(profile.getHotelPhotoMediaIds()))
                .build();
    }
}