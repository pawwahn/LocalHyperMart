package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.client.UserClient;
import com.hyperlocalmart.vendor.dto.request.CreateRegistrationRequest;
import com.hyperlocalmart.vendor.dto.request.UpdateVendorProfileRequest;
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
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class VendorRegistrationService {

    private static final String TEMP_PASSWORD_PREFIX = "HlM@";
    private static final Pattern GSTIN = Pattern.compile(
            "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    private static final Pattern FSSAI = Pattern.compile("^\\d{14}$");

    private final VendorRegistrationRequestRepository registrationRequestRepository;
    private final VendorRepository vendorRepository;
    private final ShopRepository shopRepository;
    private final UserClient userClient;
    private final VendorCommercialTermsService vendorCommercialTermsService;

    @Transactional
    public VendorRegistrationResponse create(CreateRegistrationRequest request, UUID requestedByUserId) {
        String phone = request.getPhone().trim();
        String businessName = requireName(request.getBusinessName(), "Business name");
        String shopName = requireName(request.getShopName(), "Shop name");
        String ownerName = blankToNull(request.getOwnerName());
        String gstNumber = normalizeGst(request.getGstNumber());
        String fssaiNumber = normalizeFssai(request.getFssaiNumber());
        String bankAccount = blankToNull(request.getBankAccount());
        String ifsc = blankToNull(request.getIfsc());

        if (gstNumber != null) {
            if (bankAccount == null || ifsc == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Bank account and IFSC are required when GST number is provided");
            }
        }

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
                .gstNumberEnc(gstNumber)
                .fssaiNumber(fssaiNumber)
                .bankAccountEnc(bankAccount)
                .ifscEnc(ifsc == null ? null : ifsc.toUpperCase(Locale.ROOT))
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
                .fssaiNumber(request.getFssaiNumber())
                .bankAccountEnc(request.getBankAccountEnc())
                .ifscEnc(request.getIfscEnc())
                .status(VendorStatus.ACTIVE)
                .build();
        vendor.setCreatedBy(reviewerId);
        vendor.setUpdatedBy(reviewerId);
        vendor = vendorRepository.save(vendor);
        vendorCommercialTermsService.ensureDefault(vendor.getId(), reviewerId);

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
    public VendorResponse updateVendorProfile(UUID vendorId, UUID actorUserId, UpdateVendorProfileRequest request) {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));

        String businessName = requireName(request.getBusinessName(), "Business name");
        String shopName = requireName(request.getShopName(), "Shop name");
        String gstNumber = normalizeGst(request.getGstNumber());
        String fssaiNumber = normalizeFssai(request.getFssaiNumber());
        String bankAccount = blankToNull(request.getBankAccount());
        String ifsc = blankToNull(request.getIfsc());
        if (gstNumber != null && (bankAccount == null || ifsc == null)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Bank account and IFSC are required when GST number is provided");
        }

        vendor.setBusinessName(businessName);
        vendor.setOwnerName(blankToNull(request.getOwnerName()));
        vendor.setGstNumberEnc(gstNumber);
        vendor.setFssaiNumber(fssaiNumber);
        vendor.setBankAccountEnc(bankAccount);
        vendor.setIfscEnc(ifsc == null ? null : ifsc.toUpperCase(Locale.ROOT));
        vendor.setUpdatedBy(actorUserId);
        vendor = vendorRepository.save(vendor);

        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendorId);
        if (!shops.isEmpty()) {
            Shop shop = shops.getFirst();
            shop.setShopName(shopName);
            shop.setAddress(blankToNull(request.getAddress()));
            shop.setUpdatedBy(actorUserId);
            shopRepository.save(shop);
        } else {
            Shop shop = Shop.builder()
                    .vendor(vendor)
                    .shopName(shopName)
                    .address(blankToNull(request.getAddress()))
                    .status(ShopStatus.ACTIVE)
                    .acceptingOrders(vendor.getStatus() == VendorStatus.ACTIVE)
                    .build();
            shop.setCreatedBy(actorUserId);
            shop.setUpdatedBy(actorUserId);
            shopRepository.save(shop);
        }

        return toVendorResponse(vendor);
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
                .gstNumber(request.getGstNumberEnc())
                .fssaiNumber(request.getFssaiNumber())
                .status(request.getStatus().name())
                .rejectReason(request.getRejectReason())
                .vendorId(request.getVendorId())
                .createdAt(request.getCreatedAt())
                .temporaryPassword(temporaryPassword)
                .build();
    }

    private VendorResponse toVendorResponse(Vendor vendor) {
        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendor.getId());
        Shop shop = shops.isEmpty() ? null : shops.getFirst();
        return VendorResponse.builder()
                .id(vendor.getId())
                .townId(vendor.getTownId())
                .businessName(vendor.getBusinessName())
                .ownerName(vendor.getOwnerName())
                .phone(vendor.getPhone())
                .gstNumber(vendor.getGstNumberEnc())
                .fssaiNumber(vendor.getFssaiNumber())
                .bankAccount(vendor.getBankAccountEnc())
                .ifsc(vendor.getIfscEnc())
                .status(vendor.getStatus().name())
                .shopName(shop != null ? shop.getShopName() : null)
                .address(shop != null ? shop.getAddress() : null)
                .disabledReason(vendor.getDisabledReason())
                .build();
    }

    private static String normalizeGst(String raw) {
        String value = blankToNull(raw);
        if (value == null) {
            return null;
        }
        String gst = value.toUpperCase(Locale.ROOT).replaceAll("\\s+", "");
        if (!GSTIN.matcher(gst).matches()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid GST number format");
        }
        return gst;
    }

    private static String normalizeFssai(String raw) {
        String value = blankToNull(raw);
        if (value == null) {
            return null;
        }
        String fssai = value.replaceAll("\\s+", "");
        if (!FSSAI.matcher(fssai).matches()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "FSSAI number must be 14 digits");
        }
        return fssai;
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
