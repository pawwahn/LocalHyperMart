package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.client.AdminAuditClient;
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
import com.hyperlocalmart.vendor.entity.ServiceOffering;
import com.hyperlocalmart.vendor.entity.VendorRegistrationRequest;
import com.hyperlocalmart.vendor.entity.VendorServiceFor;
import com.hyperlocalmart.vendor.entity.VendorStatus;
import com.hyperlocalmart.vendor.repository.DiagnosticsStaffRepository;
import com.hyperlocalmart.vendor.repository.LaundryProfileRepository;
import com.hyperlocalmart.vendor.repository.ServiceOfferingRepository;
import com.hyperlocalmart.vendor.repository.ShopRepository;
import com.hyperlocalmart.vendor.repository.VendorRegistrationRequestRepository;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private final DiagnosticsStaffRepository diagnosticsStaffRepository;
    private final ShopRepository shopRepository;
    private final ServiceOfferingRepository offeringRepository;
    private final LaundryProfileRepository laundryProfileRepository;
    private final com.hyperlocalmart.vendor.repository.BeautyProfileRepository beautyProfileRepository;
    private final UserClient userClient;
    private final VendorCommercialTermsService vendorCommercialTermsService;
    private final AdminAuditClient adminAuditClient;

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
        ServiceOffering service = requireOffering(request.getServiceId());
        VendorServiceFor serviceFor = resolveServiceFor(service, request.getServiceFor());

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
                .serviceId(service.getId())
                .serviceFor(serviceFor)
                .status(RegistrationRequestStatus.PENDING)
                .termsAcknowledgedAt(Instant.now())
                .termsLegalVersion(request.getAcknowledgedLegalVersion() == null
                        || request.getAcknowledgedLegalVersion() < 1
                        ? 1
                        : request.getAcknowledgedLegalVersion())
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
    public VendorRegistrationResponse approve(UUID id, UUID reviewerId, String customPassword) {
        VendorRegistrationRequest request = registrationRequestRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Registration request not found"));

        if (request.getStatus() != RegistrationRequestStatus.PENDING) {
            throw new BusinessException(ErrorCode.CONFLICT, "Registration request is not pending");
        }
        if (vendorRepository.existsByPhone(request.getPhone())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Vendor already exists for this phone");
        }

        String temporaryPassword = resolveInitialVendorPassword(request.getPhone(), customPassword);
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
                .serviceId(request.getServiceId())
                .serviceFor(request.getServiceFor())
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
        Map<String, Object> beforeApprove = new LinkedHashMap<>();
        beforeApprove.put("status", "PENDING");
        Map<String, Object> afterApprove = new LinkedHashMap<>();
        afterApprove.put("status", "APPROVED");
        List<String> approveLines = VendorAuditFormat.changeLines(beforeApprove, afterApprove);
        adminAuditClient.record(
                "vendors",
                "APPROVE_VENDOR",
                VendorAuditFormat.summary("Approved " + request.getShopName(), approveLines),
                reviewerId,
                request.getTownId(),
                vendor.getId(),
                beforeApprove,
                afterApprove,
                approveLines);

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
        VendorRegistrationRequest saved = registrationRequestRepository.save(request);
        Map<String, Object> beforeReject = new LinkedHashMap<>();
        beforeReject.put("status", "PENDING");
        Map<String, Object> afterReject = new LinkedHashMap<>();
        afterReject.put("status", "REJECTED");
        afterReject.put("rejectReason", rejectReason);
        List<String> rejectLines = VendorAuditFormat.changeLines(beforeReject, afterReject);
        adminAuditClient.record(
                "vendors",
                "REJECT_VENDOR",
                VendorAuditFormat.summary("Rejected " + request.getShopName(), rejectLines),
                reviewerId,
                request.getTownId(),
                request.getId(),
                beforeReject,
                afterReject,
                rejectLines);

        return toRegistrationResponse(saved, null);
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
        ServiceOffering service = requireOffering(request.getServiceId());
        VendorServiceFor serviceFor = resolveServiceFor(service, request.getServiceFor());
        if (gstNumber != null && (bankAccount == null || ifsc == null)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Bank account and IFSC are required when GST number is provided");
        }

        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendorId);
        Shop shop = shops.isEmpty() ? null : shops.getFirst();
        String beforeService = serviceName(vendor.getServiceId());
        Map<String, Object> beforeProfile = VendorAuditFormat.profile(vendor, shop, beforeService);
        beforeProfile.put("serviceName", beforeService);

        vendor.setBusinessName(businessName);
        vendor.setOwnerName(blankToNull(request.getOwnerName()));
        vendor.setServiceId(service.getId());
        vendor.setServiceFor(serviceFor);
        vendor.setGstNumberEnc(gstNumber);
        vendor.setFssaiNumber(fssaiNumber);
        vendor.setBankAccountEnc(bankAccount);
        vendor.setIfscEnc(ifsc == null ? null : ifsc.toUpperCase(Locale.ROOT));
        vendor.setUpdatedBy(actorUserId);
        vendor = vendorRepository.save(vendor);

        if (shop != null) {
            shop.setShopName(shopName);
            shop.setAddress(blankToNull(request.getAddress()));
            shop.setUpdatedBy(actorUserId);
            shopRepository.save(shop);
        } else {
            shop = Shop.builder()
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

        Map<String, Object> afterProfile = VendorAuditFormat.profile(vendor, shop, service.getName());
        afterProfile.put("serviceName", service.getName());
        List<String> profileLines = VendorAuditFormat.changeLines(beforeProfile, afterProfile);
        if (!profileLines.isEmpty()) {
            String shopLabel = shop.getShopName() == null ? vendor.getBusinessName() : shop.getShopName();
            adminAuditClient.record(
                    "vendors",
                    "UPDATE_VENDOR_PROFILE",
                    VendorAuditFormat.summary("Updated " + shopLabel, profileLines),
                    actorUserId,
                    vendor.getTownId(),
                    vendor.getId(),
                    beforeProfile,
                    afterProfile,
                    profileLines);
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

        List<Shop> statusShops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendorId);
        Shop statusShop = statusShops.isEmpty() ? null : statusShops.getFirst();
        String statusServiceName = serviceName(vendor.getServiceId());
        Map<String, Object> beforeStatus = VendorAuditFormat.profile(vendor, statusShop, statusServiceName);

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
        Map<String, Object> afterStatus = VendorAuditFormat.profile(vendor, statusShop, statusServiceName);
        List<String> statusLines = VendorAuditFormat.changeLines(beforeStatus, afterStatus);
        if (!statusLines.isEmpty()) {
            String statusShopName = statusShop != null && statusShop.getShopName() != null
                    ? statusShop.getShopName()
                    : vendor.getBusinessName();
            String statusHeadline = (vendor.getStatus() == VendorStatus.DISABLED ? "Disabled " : "Re-enabled ")
                    + statusShopName;
            adminAuditClient.record(
                    "vendors",
                    "UPDATE_VENDOR_STATUS",
                    VendorAuditFormat.summary(statusHeadline, statusLines),
                    actorUserId,
                    vendor.getTownId(),
                    vendor.getId(),
                    beforeStatus,
                    afterStatus,
                    statusLines);
        }
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
        Vendor vendor = resolveVendorForLogin(userId);

        List<Shop> shops = shopRepository.findByVendorIdOrderByCreatedAtAsc(vendor.getId());
        Shop shop = shops.isEmpty() ? null : shops.getFirst();
        ServiceOffering service = offeringOrNull(vendor.getServiceId());

        return VendorMeResponse.builder()
                .vendorId(vendor.getId())
                .townId(vendor.getTownId())
                .businessName(vendor.getBusinessName())
                .phone(vendor.getPhone())
                .gstNumber(vendor.getGstNumberEnc())
                .shopName(shop != null ? shop.getShopName() : null)
                .shopId(shop != null ? shop.getId() : null)
                .status(vendor.getStatus().name())
                .serviceId(service != null ? service.getId() : null)
                .serviceName(service != null ? service.getName() : null)
                .hidesListings(listingHidden(service, vendor.getId()))
                .build();
    }

    private VendorRegistrationResponse toRegistrationResponse(VendorRegistrationRequest request, String temporaryPassword) {
        ServiceOffering service = offeringOrNull(request.getServiceId());
        return VendorRegistrationResponse.builder()
                .id(request.getId())
                .townId(request.getTownId())
                .businessName(request.getBusinessName())
                .ownerName(request.getOwnerName())
                .phone(request.getPhone())
                .shopName(request.getShopName())
                .address(request.getAddress())
                .serviceId(service != null ? service.getId() : null)
                .serviceName(service != null ? service.getName() : null)
                .serviceFor(serviceForName(request.getServiceFor()))
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
        ServiceOffering service = offeringOrNull(vendor.getServiceId());
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
                .serviceId(service != null ? service.getId() : null)
                .serviceName(service != null ? service.getName() : null)
                .serviceFor(serviceForName(vendor.getServiceFor()))
                .hidesListings(listingHidden(service, vendor.getId()))
                .build();
    }

    /**
     * Owner login is {@code vendors.user_id}. Lab staff (e.g. collectors) are linked via
     * {@code diagnostics_staff.user_id} and must still reach /vendors/me to enter the portal.
     */
    private Vendor resolveVendorForLogin(UUID userId) {
        return vendorRepository.findByUserId(userId)
                .or(() -> diagnosticsStaffRepository.findByUserId(userId)
                        .map(staff -> {
                            if (!staff.isActive()) {
                                throw new BusinessException(ErrorCode.FORBIDDEN, "Staff login is disabled");
                            }
                            return staff;
                        })
                        .flatMap(staff -> vendorRepository.findById(staff.getVendorId())))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found for user"));
    }

    private boolean listingHidden(ServiceOffering service, UUID vendorId) {
        return CatalogListingPolicy.hidesListings(
                service,
                laundryProfileRepository.existsById(vendorId),
                beautyProfileRepository.existsById(vendorId));
    }

    private static VendorServiceFor resolveServiceFor(ServiceOffering service, VendorServiceFor value) {
        if (CatalogListingPolicy.isBeautyService(service.getName())) {
            return requireServiceFor(value);
        }
        if (CatalogListingPolicy.isDiagnosticsService(service.getName())) {
            return requireDiagnosticsLabType(value);
        }
        return VendorServiceFor.UNISEX;
    }

    private static VendorServiceFor requireServiceFor(VendorServiceFor value) {
        if (value == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Service for is required (Male, Female, or Unisex)");
        }
        return value;
    }

    private static VendorServiceFor requireDiagnosticsLabType(VendorServiceFor value) {
        if (value != VendorServiceFor.PRIVATE_LAB && value != VendorServiceFor.HOSPITAL_LAB) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Lab type is required (Private Lab or Hospital Lab)");
        }
        return value;
    }

    private static String serviceForName(VendorServiceFor value) {
        return value == null ? null : value.name();
    }

    private ServiceOffering requireOffering(UUID serviceId) {
        if (serviceId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Service is required");
        }
        return offeringRepository.findById(serviceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Select a service"));
    }

    private ServiceOffering offeringOrNull(UUID serviceId) {
        if (serviceId == null) {
            return null;
        }
        return offeringRepository.findById(serviceId).orElse(null);
    }

    private String serviceName(UUID serviceId) {
        ServiceOffering service = offeringOrNull(serviceId);
        return service == null ? null : service.getName();
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

    @Transactional
    public void resetVendorLoginPassword(UUID vendorId, String newPassword, UUID actorId) {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        String normalized = newPassword == null ? "" : newPassword.trim();
        validateVendorLoginPassword(normalized);
        UUID linkedUserId = ensureVendorLoginUser(vendor, normalized);
        if (!linkedUserId.equals(vendor.getUserId())) {
            vendor.setUserId(linkedUserId);
            vendor.setUpdatedBy(actorId);
            vendorRepository.save(vendor);
        }
        adminAuditClient.record(
                "vendors",
                "RESET_VENDOR_LOGIN",
                "Reset vendor portal login for " + vendor.getPhone(),
                actorId,
                vendor.getTownId(),
                vendor.getId(),
                Map.of(),
                Map.of("loginReset", true),
                List.of("loginReset: false → true"));
    }

    /**
     * Sets portal password, repairing a stale {@code vendors.user_id} or creating the login when missing.
     */
    private UUID ensureVendorLoginUser(Vendor vendor, String password) {
        if (vendor.getUserId() != null) {
            try {
                userClient.setUserPassword(vendor.getUserId(), password);
                return vendor.getUserId();
            } catch (BusinessException ex) {
                if (!isMissingUserLogin(ex)) {
                    throw ex;
                }
            }
        }
        UUID byPhone = lookupVendorUserId(vendor.getPhone());
        if (byPhone != null) {
            userClient.setUserPassword(byPhone, password);
            userClient.bindVendorContext(byPhone, vendor.getTownId(), vendor.getId());
            return byPhone;
        }
        String firstName = vendor.getOwnerName() != null && !vendor.getOwnerName().isBlank()
                ? vendor.getOwnerName().trim()
                : vendor.getBusinessName();
        try {
            UUID created = userClient.createVendorUser(vendor.getPhone(), password, firstName, vendor.getTownId());
            userClient.bindVendorContext(created, vendor.getTownId(), vendor.getId());
            return created;
        } catch (BusinessException ex) {
            if (ex.getErrorCode() == ErrorCode.CONFLICT) {
                UUID existing = lookupVendorUserId(vendor.getPhone());
                if (existing == null) {
                    throw ex;
                }
                userClient.setUserPassword(existing, password);
                userClient.bindVendorContext(existing, vendor.getTownId(), vendor.getId());
                return existing;
            }
            throw ex;
        }
    }

    private UUID lookupVendorUserId(String phone) {
        try {
            return userClient.findUserIdByPhone(phone);
        } catch (BusinessException ex) {
            if (ex.getErrorCode() == ErrorCode.NOT_FOUND || isMissingUserLogin(ex)) {
                return null;
            }
            throw ex;
        }
    }

    private static boolean isMissingUserLogin(BusinessException ex) {
        if (ex.getErrorCode() == ErrorCode.NOT_FOUND) {
            return true;
        }
        String msg = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase(Locale.ROOT);
        return msg.contains("user not found") || msg.contains("not found for phone");
    }

    private static String resolveInitialVendorPassword(String phone, String customPassword) {
        if (customPassword != null && !customPassword.isBlank()) {
            String normalized = customPassword.trim();
            validateVendorLoginPassword(normalized);
            return normalized;
        }
        if (phone == null || phone.length() < 4) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Vendor phone is invalid");
        }
        return TEMP_PASSWORD_PREFIX + phone.substring(phone.length() - 4);
    }

    private static void validateVendorLoginPassword(String password) {
        if (password == null || password.length() < 8) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Password must be at least 8 characters");
        }
        if (password.length() > 72) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Password must be at most 72 characters");
        }
    }
}
