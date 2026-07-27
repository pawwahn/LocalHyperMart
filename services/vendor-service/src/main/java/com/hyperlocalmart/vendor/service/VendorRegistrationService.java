package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.client.UserClient;
import com.hyperlocalmart.vendor.dto.request.CreateRegistrationRequest;
import com.hyperlocalmart.vendor.dto.request.UpdateVendorStatusRequest;
import com.hyperlocalmart.vendor.dto.response.VendorListResponse;
import com.hyperlocalmart.vendor.dto.response.VendorMeResponse;
import com.hyperlocalmart.vendor.dto.response.VendorRegistrationListResponse;
import com.hyperlocalmart.vendor.dto.response.VendorRegistrationResponse;
import com.hyperlocalmart.vendor.dto.response.VendorResponse;
import com.hyperlocalmart.vendor.entity.RegistrationRequestStatus;
import com.hyperlocalmart.vendor.entity.Shop;
import com.hyperlocalmart.vendor.entity.ShopStatus;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.entity.VendorRegistrationRequest;
import com.hyperlocalmart.vendor.entity.VendorStatus;
import com.hyperlocalmart.vendor.repository.ShopRepository;
import com.hyperlocalmart.vendor.repository.VendorRegistrationRequestRepository;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class VendorRegistrationService {

    private static final String TEMP_PASSWORD_PREFIX = "HlM@";

    private final VendorRegistrationRequestRepository registrationRequestRepository;
    private final VendorRepository vendorRepository;
    private final ShopRepository shopRepository;
    private final UserClient userClient;

    @Transactional
    public VendorRegistrationResponse create(CreateRegistrationRequest request, UUID requestedByUserId) {
        String phone = request.getPhone().trim();
        String businessName = requireName(request.getBusinessName(), "Business name");
        String shopName = requireName(request.getShopName(), "Shop name");
        String ownerName = blankToNull(request.getOwnerName());

        if (registrationRequestRepository.existsByPhoneAndStatus(phone, RegistrationRequestStatus.PENDING)) {
            throw new BusinessException(ErrorCode.CONFLICT, "A pending registration already exists for this phone");
        }

        VendorRegistrationRequest entity = VendorRegistrationRequest.builder()
                .townId(request.getTownId())
                .requestedBy(requestedByUserId)
                .businessName(businessName)
                .ownerName(ownerName)
                .phone(phone)
                .shopName(shopName)
                .address(blankToNull(request.getAddress()))
                .gstNumberEnc(blankToNull(request.getGstNumber()))
                .bankAccountEnc(blankToNull(request.getBankAccount()))
                .ifscEnc(blankToNull(request.getIfsc()))
                .status(RegistrationRequestStatus.PENDING)
                .build();
        entity.setCreatedBy(requestedByUserId);
        entity.setUpdatedBy(requestedByUserId);

        return toRegistrationResponse(registrationRequestRepository.save(entity), null);
    }

    @Transactional(readOnly = true)
    public VendorRegistrationListResponse list(RegistrationRequestStatus status) {
        List<VendorRegistrationRequest> requests = status == null
                ? registrationRequestRepository.findAllByOrderByCreatedAtDesc()
                : registrationRequestRepository.findByStatusOrderByCreatedAtDesc(status);
        return VendorRegistrationListResponse.builder()
                .items(requests.stream().map(r -> toRegistrationResponse(r, null)).toList())
                .build();
    }

    @Transactional
    public VendorRegistrationResponse approve(UUID id, UUID reviewerId) {
        VendorRegistrationRequest request = registrationRequestRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Registration request not found"));

        if (request.getStatus() != RegistrationRequestStatus.PENDING) {
            throw new BusinessException(ErrorCode.CONFLICT, "Registration request is not pending");
        }
        if (vendorRepository.existsByPhone(request.getPhone())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Vendor already exists for this phone");
        }

        String temporaryPassword = TEMP_PASSWORD_PREFIX + request.getPhone().substring(request.getPhone().length() - 4);
        String firstName = request.getOwnerName() != null && !request.getOwnerName().isBlank()
                ? request.getOwnerName().trim()
                : request.getBusinessName();

        UUID userId = userClient.createVendorUser(
                request.getPhone(),
                temporaryPassword,
                firstName,
                request.getTownId());

        Vendor vendor = Vendor.builder()
                .townId(request.getTownId())
                .userId(userId)
                .registrationRequestId(request.getId())
                .businessName(request.getBusinessName())
                .ownerName(request.getOwnerName())
                .phone(request.getPhone())
                .gstNumberEnc(request.getGstNumberEnc())
                .bankAccountEnc(request.getBankAccountEnc())
                .ifscEnc(request.getIfscEnc())
                .status(VendorStatus.ACTIVE)
                .build();
        vendor.setCreatedBy(reviewerId);
        vendor.setUpdatedBy(reviewerId);
        vendor = vendorRepository.save(vendor);

        Shop shop = Shop.builder()
                .vendor(vendor)
                .shopName(request.getShopName())
                .address(request.getAddress())
                .status(ShopStatus.ACTIVE)
                .acceptingOrders(true)
                .build();
        shop.setCreatedBy(reviewerId);
        shop.setUpdatedBy(reviewerId);
        shopRepository.save(shop);

        userClient.bindVendorContext(userId, vendor.getTownId(), vendor.getId());

        request.setStatus(RegistrationRequestStatus.APPROVED);
        request.setVendorId(vendor.getId());
        request.setReviewedBy(reviewerId);
        request.setReviewedAt(Instant.now());
        request.setUpdatedBy(reviewerId);
        registrationRequestRepository.save(request);

        return toRegistrationResponse(request, temporaryPassword);
    }

    @Transactional
    public VendorRegistrationResponse reject(UUID id, UUID reviewerId, String reason) {
        VendorRegistrationRequest request = registrationRequestRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Registration request not found"));

        if (request.getStatus() != RegistrationRequestStatus.PENDING) {
            throw new BusinessException(ErrorCode.CONFLICT, "Registration request is not pending");
        }

        String rejectReason = reason == null ? null : reason.trim();
        if (rejectReason == null || rejectReason.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Reject reason is required");
        }

        request.setStatus(RegistrationRequestStatus.REJECTED);
        request.setRejectReason(rejectReason);
        request.setReviewedBy(reviewerId);
        request.setReviewedAt(Instant.now());
        request.setUpdatedBy(reviewerId);

        return toRegistrationResponse(registrationRequestRepository.save(request), null);
    }

    @Transactional(readOnly = true)
    public VendorListResponse listVendors(UUID townId, VendorStatus status) {
        List<Vendor> vendors = status == null
                ? vendorRepository.findByTownIdOrderByCreatedAtDesc(townId)
                : vendorRepository.findByTownIdAndStatusOrderByCreatedAtDesc(townId, status);

        return VendorListResponse.builder()
                .items(vendors.stream().map(this::toVendorResponse).toList())
                .build();
    }

    @Transactional
    public VendorResponse updateVendorStatus(UUID vendorId, UUID actorUserId, UpdateVendorStatusRequest request) {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));

        VendorStatus next = request.getStatus();
        if (next != VendorStatus.ACTIVE && next != VendorStatus.DISABLED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Status must be ACTIVE or DISABLED");
        }

        if (next == VendorStatus.DISABLED) {
            if (vendor.getStatus() == VendorStatus.DISABLED) {
                return toVendorResponse(vendor);
            }
            String reason = blankToNull(request.getReason());
            if (reason == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Disable reason is required");
            }
            vendor.setStatus(VendorStatus.DISABLED);
            vendor.setDisabledBy(actorUserId);
            vendor.setDisabledReason(reason);
            pauseShops(vendor.getId(), actorUserId);
        } else {
            // Re-enable restores login and reopens shops so buyers see listings again.
            vendor.setStatus(VendorStatus.ACTIVE);
            vendor.setDisabledBy(null);
            vendor.setDisabledReason(null);
            resumeShops(vendor.getId(), actorUserId);
        }

        vendor.setUpdatedBy(actorUserId);
        vendor = vendorRepository.save(vendor);
        syncLoginStatus(vendor);
        return toVendorResponse(vendor);
    }

    private void pauseShops(UUID vendorId, UUID actorUserId) {
        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendorId);
        for (Shop shop : shops) {
            shop.setAcceptingOrders(false);
            shop.setUpdatedBy(actorUserId);
        }
        if (!shops.isEmpty()) {
            shopRepository.saveAll(shops);
        }
    }

    private void resumeShops(UUID vendorId, UUID actorUserId) {
        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendorId);
        for (Shop shop : shops) {
            shop.setAcceptingOrders(true);
            if (shop.getStatus() != ShopStatus.ACTIVE) {
                shop.setStatus(ShopStatus.ACTIVE);
            }
            shop.setUpdatedBy(actorUserId);
        }
        if (!shops.isEmpty()) {
            shopRepository.saveAll(shops);
        }
    }

    private void syncLoginStatus(Vendor vendor) {
        if (vendor.getUserId() == null) {
            return;
        }
        try {
            if (vendor.getStatus() == VendorStatus.DISABLED) {
                userClient.updateUserStatus(vendor.getUserId(), "DISABLED");
            } else {
                userClient.updateUserStatus(vendor.getUserId(), "ACTIVE");
            }
        } catch (Exception ex) {
            log.warn("Could not sync login status for vendor {}: {}", vendor.getId(), ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public VendorMeResponse getMe(UUID userId) {
        Vendor vendor = vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found for user"));

        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendor.getId());
        Shop shop = shops.isEmpty() ? null : shops.getFirst();

        return VendorMeResponse.builder()
                .vendorId(vendor.getId())
                .townId(vendor.getTownId())
                .businessName(vendor.getBusinessName())
                .phone(vendor.getPhone())
                .shopName(shop != null ? shop.getShopName() : null)
                .shopId(shop != null ? shop.getId() : null)
                .status(vendor.getStatus().name())
                .build();
    }

    private VendorRegistrationResponse toRegistrationResponse(VendorRegistrationRequest request, String temporaryPassword) {
        return VendorRegistrationResponse.builder()
                .id(request.getId())
                .townId(request.getTownId())
                .businessName(request.getBusinessName())
                .ownerName(request.getOwnerName())
                .phone(request.getPhone())
                .shopName(request.getShopName())
                .address(request.getAddress())
                .status(request.getStatus().name())
                .rejectReason(request.getRejectReason())
                .vendorId(request.getVendorId())
                .createdAt(request.getCreatedAt())
                .temporaryPassword(temporaryPassword)
                .build();
    }

    private VendorResponse toVendorResponse(Vendor vendor) {
        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendor.getId());
        String shopName = shops.isEmpty() ? null : shops.getFirst().getShopName();
        return VendorResponse.builder()
                .id(vendor.getId())
                .townId(vendor.getTownId())
                .businessName(vendor.getBusinessName())
                .ownerName(vendor.getOwnerName())
                .phone(vendor.getPhone())
                .status(vendor.getStatus().name())
                .shopName(shopName)
                .disabledReason(vendor.getDisabledReason())
                .build();
    }

    private static String requireName(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " is required");
        }
        return value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
