package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.common.util.IndianMobilePhones;
import com.hyperlocalmart.common.util.SlotBlocksByDate;
import com.hyperlocalmart.vendor.client.UserClient;
import com.hyperlocalmart.vendor.diagnostics.DiagnosticsConstants;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsBranchRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsProfileRequest;
import com.hyperlocalmart.vendor.dto.request.SyncFieldAgentRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsStaffRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsPackageRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsTestRequest;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsLabCard;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsLabDetailResponse;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsStaffSessionResponse;
import com.hyperlocalmart.vendor.entity.DiagnosticsBranch;
import com.hyperlocalmart.vendor.entity.DiagnosticsProfile;
import com.hyperlocalmart.vendor.entity.DiagnosticsSlotTemplate;
import com.hyperlocalmart.vendor.entity.DiagnosticsStaff;
import com.hyperlocalmart.vendor.entity.DiagnosticsStaffAudit;
import com.hyperlocalmart.vendor.entity.DiagnosticsPackage;
import com.hyperlocalmart.vendor.entity.DiagnosticsPackageMember;
import com.hyperlocalmart.vendor.entity.DiagnosticsTest;
import com.hyperlocalmart.vendor.entity.ServiceOffering;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.entity.VendorStatus;
import com.hyperlocalmart.vendor.repository.DiagnosticsBranchRepository;
import com.hyperlocalmart.vendor.repository.DiagnosticsProfileRepository;
import com.hyperlocalmart.vendor.repository.DiagnosticsSlotTemplateRepository;
import com.hyperlocalmart.vendor.repository.DiagnosticsStaffAuditRepository;
import com.hyperlocalmart.vendor.repository.DiagnosticsStaffRepository;
import com.hyperlocalmart.vendor.repository.DiagnosticsPackageMemberRepository;
import com.hyperlocalmart.vendor.repository.DiagnosticsPackageRepository;
import com.hyperlocalmart.vendor.repository.DiagnosticsTestRepository;
import com.hyperlocalmart.vendor.repository.ServiceOfferingRepository;
import com.hyperlocalmart.vendor.entity.VendorCommercialTerms;
import com.hyperlocalmart.vendor.repository.VendorCommercialTermsRepository;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiagnosticsVendorService {

    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    private final VendorRepository vendorRepository;
    private final DiagnosticsProfileRepository profileRepository;
    private final DiagnosticsBranchRepository branchRepository;
    private final DiagnosticsTestRepository testRepository;
    private final DiagnosticsPackageRepository packageRepository;
    private final DiagnosticsPackageMemberRepository packageMemberRepository;
    private final DiagnosticsSlotTemplateRepository slotRepository;
    private final DiagnosticsStaffRepository staffRepository;
    private final DiagnosticsStaffAuditRepository auditRepository;
    private final ServiceOfferingRepository offeringRepository;
    private final ShopService shopService;
    private final UserClient userClient;
    private final VendorCommercialTermsRepository termsRepository;

    public record StaffContext(
            UUID vendorId,
            UUID staffId,
            String roleType,
            String title,
            boolean collectionCapable,
            boolean vendorOwner) {
    }

    @Transactional(readOnly = true)
    public List<DiagnosticsLabCard> listForTown(UUID townId, boolean bookableOnly) {
        List<Vendor> vendors = vendorRepository.findByTownIdOrderByCreatedAtDesc(townId);
        if (vendors.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = vendors.stream().map(Vendor::getId).toList();
        Map<UUID, DiagnosticsProfile> profiles = profileRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.toMap(DiagnosticsProfile::getVendorId, Function.identity()));
        Map<UUID, List<DiagnosticsTest>> tests = testRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.groupingBy(DiagnosticsTest::getVendorId));
        Map<UUID, List<DiagnosticsPackage>> packages = packageRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.groupingBy(DiagnosticsPackage::getVendorId));
        List<UUID> packageIds = packages.values().stream().flatMap(List::stream).map(DiagnosticsPackage::getId).toList();
        Map<UUID, List<DiagnosticsPackageMember>> membersByPackage = packageIds.isEmpty()
                ? Map.of()
                : packageMemberRepository.findByPackageIdIn(packageIds).stream()
                        .collect(Collectors.groupingBy(DiagnosticsPackageMember::getPackageId));
        Map<UUID, List<DiagnosticsBranch>> branches = branchRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.groupingBy(DiagnosticsBranch::getVendorId));
        Map<UUID, ServiceOffering> offerings = offeringsById();
        Map<UUID, Boolean> shopOpen = shopService.vendorShopOpenForCustomers(ids);
        List<DiagnosticsLabCard> out = new ArrayList<>();
        for (Vendor vendor : vendors) {
            if (!isDiagnosticsVendor(vendor, offerings)) {
                continue;
            }
            DiagnosticsProfile profile = profiles.get(vendor.getId());
            if (bookableOnly) {
                if (profile == null || !profile.isEnabled() || !profile.isBookable()
                        || vendor.getStatus() != VendorStatus.ACTIVE) {
                    continue;
                }
                if (!shopOpen.getOrDefault(vendor.getId(), true)) {
                    continue;
                }
                List<DiagnosticsTest> activeTests = dedupeCatalogTests(tests.getOrDefault(vendor.getId(), List.of())).stream()
                        .filter(t -> t.isActive() && t.isHomeCollection())
                        .toList();
                List<DiagnosticsPackage> activePackages = packages.getOrDefault(vendor.getId(), List.of()).stream()
                        .filter(DiagnosticsPackage::isActive)
                        .toList();
                if (activeTests.isEmpty() && activePackages.isEmpty()) {
                    continue;
                }
            }
            DiagnosticsLabCard card = toCard(
                    vendor,
                    profile,
                    tests.get(vendor.getId()),
                    packages.get(vendor.getId()),
                    membersByPackage,
                    branches.get(vendor.getId()));
            if (bookableOnly) {
                card.setTests(card.getTests().stream().filter(t -> t.isHomeCollection()).toList());
            }
            out.add(card);
        }
        out.sort(Comparator.comparing(
                        (DiagnosticsLabCard row) -> row.getBusinessName() == null ? "" : row.getBusinessName(),
                        String.CASE_INSENSITIVE_ORDER)
                .thenComparing(DiagnosticsLabCard::getVendorId));
        return out;
    }

    @Transactional(readOnly = true)
    public DiagnosticsLabDetailResponse get(UUID vendorId) {
        return buildDetail(requireVendor(vendorId), true, true);
    }

    @Transactional
    public DiagnosticsLabDetailResponse getBookable(UUID vendorId) {
        if (!shopService.isVendorShopOpenForCustomers(vendorId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "This lab is paused — bookings are not available right now");
        }
        Vendor vendor = requireVendor(vendorId);
        DiagnosticsProfile profile = profileRepository.findById(vendorId).orElse(null);
        if (profile == null || !profile.isEnabled() || !profile.isBookable()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This lab is not taking bookings");
        }
        ensureDefaultCollectionSlots(vendorId);
        DiagnosticsLabDetailResponse detail = buildDetail(vendor, false, false);
        List<DiagnosticsLabDetailResponse.TestRow> activeTests = detail.getTests().stream()
                .filter(DiagnosticsLabDetailResponse.TestRow::isActive)
                .toList();
        detail.setTests(activeTests);
        detail.setPackages(filterBookablePackages(detail.getPackages(), activeTests));
        detail.setBranches(detail.getBranches().stream().filter(DiagnosticsLabDetailResponse.BranchRow::isActive).toList());
        return detail;
    }

    @Transactional(readOnly = true)
    public UUID vendorIdForUser(UUID userId) {
        return vendorRepository.findByUserId(userId)
                .map(Vendor::getId)
                .or(() -> staffRepository.findByUserId(userId).map(DiagnosticsStaff::getVendorId))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Diagnostics vendor not found"));
    }

    @Transactional(readOnly = true)
    public StaffContext resolveStaffContext(UUID userId) {
        var owner = vendorRepository.findByUserId(userId);
        if (owner.isPresent()) {
            return new StaffContext(owner.get().getId(), null, DiagnosticsConstants.ROLE_LAB_ADMIN, null, true, true);
        }
        DiagnosticsStaff staff = staffRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Diagnostics staff not found"));
        if (!staff.isActive()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Staff login is disabled");
        }
        return new StaffContext(
                staff.getVendorId(),
                staff.getId(),
                staff.getRoleType(),
                staff.getTitle(),
                staff.isCollectionCapable(),
                false);
    }

    @Transactional(readOnly = true)
    public DiagnosticsLabDetailResponse getForUser(UUID userId) {
        UUID vendorId = vendorIdForUser(userId);
        return buildDetail(requireVendor(vendorId), true, true);
    }

    @Transactional(readOnly = true)
    public DiagnosticsStaffSessionResponse staffSessionForUser(UUID userId) {
        StaffContext ctx = resolveStaffContext(userId);
        Vendor vendor = requireVendor(ctx.vendorId());
        String displayName = vendor.getBusinessName();
        if (ctx.staffId() != null) {
            displayName = staffRepository.findById(ctx.staffId())
                    .map(DiagnosticsStaff::getDisplayName)
                    .orElse(displayName);
        }
        return staffSessionFromContext(ctx, displayName);
    }

    @Transactional(readOnly = true)
    public List<DiagnosticsLabDetailResponse.AuditRow> auditForUser(UUID userId) {
        UUID vendorId = vendorIdForUser(userId);
        return auditRepository.findByVendorIdOrderByCreatedAtDesc(vendorId).stream()
                .limit(100)
                .map(a -> DiagnosticsLabDetailResponse.AuditRow.builder()
                        .id(a.getId())
                        .eventType(a.getEventType())
                        .createdAt(a.getCreatedAt() == null ? null : a.getCreatedAt().toString())
                        .actorStaffId(a.getActorStaffId())
                        .build())
                .toList();
    }

    @Transactional
    public DiagnosticsLabDetailResponse upsertByAdmin(UUID vendorId, UUID actorId, UpsertDiagnosticsProfileRequest request) {
        Vendor vendor = requireVendor(vendorId);
        if (!isDiagnosticsVendor(vendor, offeringsById())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Vendor is not a diagnostics lab");
        }
        DiagnosticsProfile profile = profileRepository.findById(vendorId).orElseGet(() -> DiagnosticsProfile.builder()
                .vendorId(vendorId)
                .build());
        applyProfile(profile, request);
        profile.setUpdatedBy(actorId);
        profileRepository.save(profile);
        return get(vendorId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse upsertProfileByVendor(UUID userId, UpsertDiagnosticsProfileRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        requireWriteAccess(userId);
        DiagnosticsProfile profile = profileRepository.findById(vendorId).orElseGet(() -> DiagnosticsProfile.builder()
                .vendorId(vendorId)
                .build());
        applyProfile(profile, request);
        profile.setUpdatedBy(userId);
        profileRepository.save(profile);
        audit(vendorId, userId, "PROFILE_UPDATED", Map.of("enabled", profile.isEnabled(), "bookable", profile.isBookable()));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse createBranch(UUID userId, UpsertDiagnosticsBranchRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsBranch branch = DiagnosticsBranch.builder()
                .vendorId(vendorId)
                .label(trim(request.getLabel()))
                .addressLine(trim(request.getAddressLine()))
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .homeCollectionRadiusKm(radius(request.getHomeCollectionRadiusKm()))
                .active(request.getActive() == null || request.getActive())
                .sortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder())
                .build();
        branch.setCreatedBy(userId);
        branch.setUpdatedBy(userId);
        branchRepository.save(branch);
        replaceSlots(branch.getId(), request.getSlots());
        audit(vendorId, ctx.staffId(), "BRANCH_CREATED", Map.of("branchId", branch.getId(), "label", branch.getLabel()));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse updateBranch(UUID userId, UUID branchId, UpsertDiagnosticsBranchRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsBranch branch = branchRepository.findByIdAndVendorId(branchId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Branch not found"));
        branch.setLabel(trim(request.getLabel()));
        branch.setAddressLine(trim(request.getAddressLine()));
        branch.setLatitude(request.getLatitude());
        branch.setLongitude(request.getLongitude());
        if (request.getHomeCollectionRadiusKm() != null) {
            branch.setHomeCollectionRadiusKm(radius(request.getHomeCollectionRadiusKm()));
        }
        if (request.getActive() != null) {
            branch.setActive(request.getActive());
        }
        if (request.getSortOrder() != null) {
            branch.setSortOrder(request.getSortOrder());
        }
        branch.setUpdatedBy(userId);
        applyBranchSlotBlocks(branch, request);
        branchRepository.save(branch);
        if (request.getSlots() != null) {
            replaceSlots(branchId, request.getSlots());
        }
        audit(vendorId, ctx.staffId(), "BRANCH_UPDATED", Map.of("branchId", branchId));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse deleteBranch(UUID userId, UUID branchId) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsBranch branch = branchRepository.findByIdAndVendorId(branchId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Branch not found"));
        branch.setActive(false);
        branch.setUpdatedBy(userId);
        branchRepository.save(branch);
        audit(vendorId, ctx.staffId(), "BRANCH_DISABLED", Map.of("branchId", branchId));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse createTest(UUID userId, UpsertDiagnosticsTestRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsTest test = resolveTestForWrite(vendorId, null, request);
        boolean created = test.getId() == null;
        if (created) {
            test.setCreatedBy(userId);
        }
        mapTest(test, vendorId, request);
        test.setUpdatedBy(userId);
        testRepository.save(test);
        deactivateDuplicateTests(vendorId, test.getCode(), test.getId());
        audit(vendorId, ctx.staffId(), created ? "TEST_CREATED" : "TEST_UPDATED", Map.of("testId", test.getId(), "name", test.getName()));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse updateTest(UUID userId, UUID testId, UpsertDiagnosticsTestRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsTest test = testRepository.findByIdAndVendorId(testId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Test not found"));
        mapTest(test, vendorId, request);
        test.setUpdatedBy(userId);
        testRepository.save(test);
        deactivateDuplicateTests(vendorId, test.getCode(), test.getId());
        audit(vendorId, ctx.staffId(), "TEST_UPDATED", Map.of("testId", testId, "price", test.getPrice()));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse deleteTest(UUID userId, UUID testId) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsTest test = testRepository.findByIdAndVendorId(testId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Test not found"));
        test.setActive(false);
        test.setUpdatedBy(userId);
        testRepository.save(test);
        audit(vendorId, ctx.staffId(), "TEST_DISABLED", Map.of("testId", testId));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse createPackage(UUID userId, UpsertDiagnosticsPackageRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsPackage pkg = resolvePackageForWrite(vendorId, null, request);
        boolean created = pkg.getId() == null;
        if (created) {
            pkg.setCreatedBy(userId);
        }
        mapPackage(pkg, vendorId, request);
        pkg.setUpdatedBy(userId);
        packageRepository.save(pkg);
        replacePackageMembers(vendorId, pkg.getId(), request.getTestIds());
        deactivateDuplicatePackages(vendorId, pkg.getCode(), pkg.getId());
        audit(vendorId, ctx.staffId(), created ? "PACKAGE_CREATED" : "PACKAGE_UPDATED", Map.of("packageId", pkg.getId(), "name", pkg.getName()));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse updatePackage(UUID userId, UUID packageId, UpsertDiagnosticsPackageRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsPackage pkg = packageRepository.findByIdAndVendorId(packageId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Package not found"));
        mapPackage(pkg, vendorId, request);
        pkg.setUpdatedBy(userId);
        packageRepository.save(pkg);
        replacePackageMembers(vendorId, pkg.getId(), request.getTestIds());
        deactivateDuplicatePackages(vendorId, pkg.getCode(), pkg.getId());
        audit(vendorId, ctx.staffId(), "PACKAGE_UPDATED", Map.of("packageId", packageId, "price", pkg.getPrice()));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse deletePackage(UUID userId, UUID packageId) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext ctx = requireWriteAccess(userId);
        DiagnosticsPackage pkg = packageRepository.findByIdAndVendorId(packageId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Package not found"));
        pkg.setActive(false);
        pkg.setUpdatedBy(userId);
        packageRepository.save(pkg);
        audit(vendorId, ctx.staffId(), "PACKAGE_DISABLED", Map.of("packageId", packageId));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse adminCreateTest(UUID vendorId, UUID actorId, UpsertDiagnosticsTestRequest request) {
        requireDiagnosticsVendor(vendorId);
        DiagnosticsTest test = resolveTestForWrite(vendorId, null, request);
        boolean created = test.getId() == null;
        if (created) {
            test.setCreatedBy(actorId);
        }
        mapTest(test, vendorId, request);
        test.setUpdatedBy(actorId);
        testRepository.save(test);
        deactivateDuplicateTests(vendorId, test.getCode(), test.getId());
        audit(vendorId, null, created ? "TEST_CREATED" : "TEST_UPDATED", Map.of("testId", test.getId(), "name", test.getName(), "byAdmin", true));
        return get(vendorId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse adminUpdateTest(
            UUID vendorId, UUID actorId, UUID testId, UpsertDiagnosticsTestRequest request) {
        requireDiagnosticsVendor(vendorId);
        DiagnosticsTest test = testRepository.findByIdAndVendorId(testId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Test not found"));
        mapTest(test, vendorId, request);
        test.setUpdatedBy(actorId);
        testRepository.save(test);
        deactivateDuplicateTests(vendorId, test.getCode(), test.getId());
        audit(vendorId, null, "TEST_UPDATED", Map.of("testId", testId, "price", test.getPrice(), "byAdmin", true));
        return get(vendorId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse adminCreatePackage(UUID vendorId, UUID actorId, UpsertDiagnosticsPackageRequest request) {
        requireDiagnosticsVendor(vendorId);
        DiagnosticsPackage pkg = resolvePackageForWrite(vendorId, null, request);
        boolean created = pkg.getId() == null;
        if (created) {
            pkg.setCreatedBy(actorId);
        }
        mapPackage(pkg, vendorId, request);
        pkg.setUpdatedBy(actorId);
        packageRepository.save(pkg);
        replacePackageMembers(vendorId, pkg.getId(), request.getTestIds());
        deactivateDuplicatePackages(vendorId, pkg.getCode(), pkg.getId());
        audit(vendorId, null, created ? "PACKAGE_CREATED" : "PACKAGE_UPDATED", Map.of("packageId", pkg.getId(), "name", pkg.getName(), "byAdmin", true));
        return get(vendorId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse adminUpdatePackage(
            UUID vendorId, UUID actorId, UUID packageId, UpsertDiagnosticsPackageRequest request) {
        requireDiagnosticsVendor(vendorId);
        DiagnosticsPackage pkg = packageRepository.findByIdAndVendorId(packageId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Package not found"));
        mapPackage(pkg, vendorId, request);
        pkg.setUpdatedBy(actorId);
        packageRepository.save(pkg);
        replacePackageMembers(vendorId, pkg.getId(), request.getTestIds());
        deactivateDuplicatePackages(vendorId, pkg.getCode(), pkg.getId());
        audit(vendorId, null, "PACKAGE_UPDATED", Map.of("packageId", packageId, "price", pkg.getPrice(), "byAdmin", true));
        return get(vendorId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse createStaff(UUID userId, UpsertDiagnosticsStaffRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext actor = requireStaffAdmin(userId);
        validateStaffRequest(request, true);
        enforceManagerLimit(vendorId, request.getTitle(), null);
        Vendor vendor = requireVendor(vendorId);
        String phone = normalizePhone(request.getPhone());
        String displayName = trim(request.getDisplayName());
        Optional<DiagnosticsStaff> byPhone = staffRepository.findByVendorIdAndPhone(vendorId, phone);
        if (byPhone.isPresent()) {
            DiagnosticsStaff existing = byPhone.get();
            applyStaffFields(existing, request, displayName, phone);
            existing.setActive(true);
            existing.setUpdatedBy(userId);
            staffRepository.save(existing);
            userClient.updateUserStatus(existing.getUserId(), "ACTIVE");
            userClient.bindVendorContext(existing.getUserId(), vendor.getTownId(), vendor.getId());
            audit(vendorId, actor.staffId(), "STAFF_REENABLED", staffPayload(existing));
            return getForUser(userId);
        }
        UUID staffUserId = resolveVendorStaffUserId(phone, request.getPassword(), displayName, vendor.getTownId());
        Optional<DiagnosticsStaff> byUser = staffRepository.findByUserId(staffUserId);
        if (byUser.isPresent() && !byUser.get().getVendorId().equals(vendorId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "This login is already assigned to another lab");
        }
        userClient.bindVendorContext(staffUserId, vendor.getTownId(), vendor.getId());
        DiagnosticsStaff staff = byUser.filter(s -> s.getVendorId().equals(vendorId)).orElseGet(DiagnosticsStaff::new);
        boolean created = staff.getId() == null;
        staff.setVendorId(vendorId);
        staff.setUserId(staffUserId);
        applyStaffFields(staff, request, displayName, phone);
        staff.setActive(true);
        if (created) {
            staff.setCreatedBy(userId);
        }
        staff.setUpdatedBy(userId);
        staffRepository.save(staff);
        userClient.updateUserStatus(staffUserId, "ACTIVE");
        audit(vendorId, actor.staffId(), created ? "STAFF_CREATED" : "STAFF_LINKED", staffPayload(staff));
        return getForUser(userId);
    }

    @Transactional
    public DiagnosticsLabDetailResponse updateStaff(UUID userId, UUID staffId, UpsertDiagnosticsStaffRequest request) {
        UUID vendorId = vendorIdForUser(userId);
        StaffContext actor = requireStaffAdmin(userId);
        DiagnosticsStaff staff = staffRepository.findByIdAndVendorId(staffId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Staff not found"));
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            if (request.getPassword().length() < 6) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Password must be at least 6 characters");
            }
            userClient.setUserPassword(staff.getUserId(), request.getPassword());
            audit(vendorId, actor.staffId(), "STAFF_PASSWORD_RESET", staffPayload(staff));
        }
        if (request.getRoleType() != null) {
            staff.setRoleType(normalizeRole(request.getRoleType()));
        }
        if (request.getTitle() != null) {
            enforceManagerLimit(vendorId, request.getTitle(), staffId);
            staff.setTitle(trim(request.getTitle()));
        }
        if (request.getDisplayName() != null) {
            staff.setDisplayName(trim(request.getDisplayName()));
        }
        if (request.getCollectionCapable() != null) {
            staff.setCollectionCapable(request.getCollectionCapable());
        }
        if (request.getActive() != null) {
            boolean next = request.getActive();
            if (!next && DiagnosticsConstants.ROLE_LAB_ADMIN.equals(staff.getRoleType())) {
                long admins = staffRepository.findByVendorIdOrderByDisplayNameAsc(vendorId).stream()
                        .filter(s -> s.isActive() && DiagnosticsConstants.ROLE_LAB_ADMIN.equals(s.getRoleType()))
                        .count();
                if (admins <= 1) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At least one lab admin must remain active");
                }
            }
            staff.setActive(next);
            userClient.updateUserStatus(staff.getUserId(), next ? "ACTIVE" : "DISABLED");
            audit(vendorId, actor.staffId(), next ? "STAFF_REENABLED" : "STAFF_DISABLED", staffPayload(staff));
        } else {
            audit(vendorId, actor.staffId(), "ROLES_CHANGED", staffPayload(staff));
        }
        staff.setUpdatedBy(userId);
        staffRepository.save(staff);
        return getForUser(userId);
    }

    private DiagnosticsLabDetailResponse buildDetail(Vendor vendor, boolean includeStaff, boolean includeAudit) {
        UUID vendorId = vendor.getId();
        DiagnosticsProfile profile = profileRepository.findById(vendorId).orElse(null);
        List<DiagnosticsBranch> branches = branchRepository.findByVendorIdOrderBySortOrderAscLabelAsc(vendorId);
        List<UUID> branchIds = branches.stream().map(DiagnosticsBranch::getId).toList();
        Map<UUID, List<DiagnosticsSlotTemplate>> slotsByBranch = branchIds.isEmpty()
                ? Map.of()
                : slotRepository.findByBranchIdIn(branchIds).stream()
                        .collect(Collectors.groupingBy(DiagnosticsSlotTemplate::getBranchId));
        List<DiagnosticsTest> tests = dedupeCatalogTests(testRepository.findByVendorIdOrderBySortOrderAscNameAsc(vendorId));
        List<DiagnosticsPackage> packages = dedupeCatalogPackages(packageRepository.findByVendorIdOrderBySortOrderAscNameAsc(vendorId));
        List<UUID> packageIds = packages.stream().map(DiagnosticsPackage::getId).toList();
        Map<UUID, List<UUID>> membersByPackage = packageIds.isEmpty()
                ? Map.of()
                : packageMemberRepository.findByPackageIdIn(packageIds).stream()
                        .collect(Collectors.groupingBy(
                                DiagnosticsPackageMember::getPackageId,
                                Collectors.mapping(DiagnosticsPackageMember::getTestId, Collectors.toList())));
        DiagnosticsLabDetailResponse.DiagnosticsLabDetailResponseBuilder builder = DiagnosticsLabDetailResponse.builder()
                .vendorId(vendorId)
                .townId(vendor.getTownId())
                .businessName(vendor.getBusinessName())
                .serviceFor(vendor.getServiceFor().name())
                .phone(vendor.getPhone())
                .vendorStatus(vendor.getStatus().name())
                .enabled(profile != null && profile.isEnabled())
                .bookable(profile != null && profile.isBookable())
                .homeCollectionFee(profile == null ? BigDecimal.ZERO : money(profile.getHomeCollectionFee()))
                .branches(branches.stream().map(b -> branchRow(b, slotsByBranch.getOrDefault(b.getId(), List.of()))).toList())
                .tests(tests.stream().map(this::testRow).toList())
                .packages(packages.stream()
                        .map(p -> packageRow(p, membersByPackage.getOrDefault(p.getId(), List.of())))
                        .toList());
        if (includeStaff) {
            builder.staff(staffRepository.findByVendorIdOrderByDisplayNameAsc(vendorId).stream()
                    .map(this::staffRow)
                    .toList());
        }
        if (includeAudit) {
            builder.audit(auditRepository.findByVendorIdOrderByCreatedAtDesc(vendorId).stream()
                    .limit(100)
                    .map(a -> DiagnosticsLabDetailResponse.AuditRow.builder()
                            .id(a.getId())
                            .eventType(a.getEventType())
                            .createdAt(a.getCreatedAt() == null ? null : a.getCreatedAt().toString())
                            .actorStaffId(a.getActorStaffId())
                            .build())
                    .toList());
        }
        termsRepository.findByVendorIdAndEffectiveToIsNull(vendorId).ifPresent(terms -> applyFees(builder, terms));
        return builder.build();
    }

    private static void applyFees(
            DiagnosticsLabDetailResponse.DiagnosticsLabDetailResponseBuilder builder,
            VendorCommercialTerms terms) {
        builder.feeModel(terms.getFeeModel().name())
                .perPieceAmount(terms.getPerPieceAmount())
                .perOrderFlatAmount(terms.getPerOrderFlatAmount())
                .monthlySubscriptionAmount(terms.getMonthlySubscriptionAmount());
    }

    private DiagnosticsLabCard toCard(
            Vendor vendor,
            DiagnosticsProfile profile,
            List<DiagnosticsTest> tests,
            List<DiagnosticsPackage> packages,
            Map<UUID, List<DiagnosticsPackageMember>> membersByPackage,
            List<DiagnosticsBranch> branches) {
        List<DiagnosticsTest> rows = tests == null ? List.of() : tests;
        List<DiagnosticsPackage> pkgRows = packages == null ? List.of() : packages;
        int activeBranches = branches == null ? 0 : (int) branches.stream().filter(DiagnosticsBranch::isActive).count();
        return DiagnosticsLabCard.builder()
                .vendorId(vendor.getId())
                .townId(vendor.getTownId())
                .businessName(vendor.getBusinessName())
                .serviceFor(vendor.getServiceFor().name())
                .phone(vendor.getPhone())
                .vendorStatus(vendor.getStatus().name())
                .enabled(profile != null && profile.isEnabled())
                .bookable(profile != null && profile.isBookable())
                .homeCollectionFee(profile == null ? BigDecimal.ZERO : money(profile.getHomeCollectionFee()))
                .activeBranchCount(activeBranches)
                .tests(rows.stream()
                        .filter(DiagnosticsTest::isActive)
                        .map(t -> DiagnosticsLabCard.TestRow.builder()
                                .id(t.getId())
                                .code(t.getCode())
                                .name(t.getName())
                                .price(money(t.getPrice()))
                                .fastingNote(t.getFastingNote())
                                .prescriptionRequired(t.isPrescriptionRequired())
                                .homeCollection(t.isHomeCollection())
                                .active(t.isActive())
                                .build())
                        .toList())
                .packages(filterBookablePackageCards(
                        pkgRows,
                        membersByPackage,
                        rows.stream().filter(DiagnosticsTest::isActive).toList()))
                .build();
    }

    private DiagnosticsLabDetailResponse.BranchRow branchRow(DiagnosticsBranch branch, List<DiagnosticsSlotTemplate> slots) {
        return DiagnosticsLabDetailResponse.BranchRow.builder()
                .id(branch.getId())
                .label(branch.getLabel())
                .addressLine(branch.getAddressLine())
                .latitude(branch.getLatitude())
                .longitude(branch.getLongitude())
                .homeCollectionRadiusKm(money(branch.getHomeCollectionRadiusKm()))
                .active(branch.isActive())
                .sortOrder(branch.getSortOrder())
                .blockedSlotsByDate(branch.getBlockedSlotsByDate() == null ? "{}" : branch.getBlockedSlotsByDate())
                .slots(slots.stream()
                        .sorted(Comparator.comparing(DiagnosticsSlotTemplate::getStartTime))
                        .map(s -> DiagnosticsLabDetailResponse.SlotRow.builder()
                                .id(s.getId())
                                .label(s.getLabel())
                                .startTime(formatTime(s.getStartTime()))
                                .endTime(formatTime(s.getEndTime()))
                                .capacity(s.getCapacity())
                                .active(s.isActive())
                                .build())
                        .toList())
                .build();
    }

    private static List<DiagnosticsLabDetailResponse.PackageRow> filterBookablePackages(
            List<DiagnosticsLabDetailResponse.PackageRow> packages,
            List<DiagnosticsLabDetailResponse.TestRow> activeTests) {
        if (packages == null || packages.isEmpty()) {
            return List.of();
        }
        java.util.Set<UUID> activeTestIds = activeTests.stream()
                .map(DiagnosticsLabDetailResponse.TestRow::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        return packages.stream()
                .filter(DiagnosticsLabDetailResponse.PackageRow::isActive)
                .filter(p -> p.getTestIds() != null && !p.getTestIds().isEmpty())
                .filter(p -> p.getPrice() != null && p.getPrice().signum() > 0)
                .filter(p -> p.getTestIds().stream().allMatch(activeTestIds::contains))
                .toList();
    }

    private static List<DiagnosticsLabCard.PackageRow> filterBookablePackageCards(
            List<DiagnosticsPackage> packages,
            Map<UUID, List<DiagnosticsPackageMember>> membersByPackage,
            List<DiagnosticsTest> activeTests) {
        java.util.Set<UUID> activeTestIds = activeTests.stream()
                .map(DiagnosticsTest::getId)
                .collect(Collectors.toSet());
        return packages.stream()
                .filter(DiagnosticsPackage::isActive)
                .map(p -> {
                    List<UUID> testIds = membersByPackage.getOrDefault(p.getId(), List.of()).stream()
                            .map(DiagnosticsPackageMember::getTestId)
                            .toList();
                    return DiagnosticsLabCard.PackageRow.builder()
                            .id(p.getId())
                            .code(p.getCode())
                            .name(p.getName())
                            .description(p.getDescription())
                            .price(money(p.getPrice()))
                            .active(p.isActive())
                            .testIds(testIds)
                            .build();
                })
                .filter(p -> p.getTestIds() != null && !p.getTestIds().isEmpty())
                .filter(p -> p.getPrice() != null && p.getPrice().signum() > 0)
                .filter(p -> p.getTestIds().stream().allMatch(activeTestIds::contains))
                .toList();
    }

    private DiagnosticsLabDetailResponse.PackageRow packageRow(DiagnosticsPackage pkg, List<UUID> testIds) {
        return DiagnosticsLabDetailResponse.PackageRow.builder()
                .id(pkg.getId())
                .code(pkg.getCode())
                .name(pkg.getName())
                .description(pkg.getDescription())
                .price(money(pkg.getPrice()))
                .active(pkg.isActive())
                .sortOrder(pkg.getSortOrder())
                .testIds(testIds == null ? List.of() : testIds)
                .build();
    }

    private DiagnosticsLabDetailResponse.TestRow testRow(DiagnosticsTest test) {
        return DiagnosticsLabDetailResponse.TestRow.builder()
                .id(test.getId())
                .code(test.getCode())
                .name(test.getName())
                .price(money(test.getPrice()))
                .fastingNote(test.getFastingNote())
                .prescriptionRequired(test.isPrescriptionRequired())
                .homeCollection(test.isHomeCollection())
                .active(test.isActive())
                .sortOrder(test.getSortOrder())
                .build();
    }

    private DiagnosticsLabDetailResponse.StaffRow staffRow(DiagnosticsStaff staff) {
        return DiagnosticsLabDetailResponse.StaffRow.builder()
                .id(staff.getId())
                .userId(staff.getUserId())
                .phone(staff.getPhone())
                .displayName(staff.getDisplayName())
                .roleType(staff.getRoleType())
                .title(staff.getTitle())
                .collectionCapable(staff.isCollectionCapable())
                .active(staff.isActive())
                .build();
    }

    private void ensureDefaultCollectionSlots(UUID vendorId) {
        List<DiagnosticsBranch> branches = branchRepository.findByVendorIdOrderBySortOrderAscLabelAsc(vendorId);
        for (DiagnosticsBranch branch : branches) {
            if (!branch.isActive()) {
                continue;
            }
            List<DiagnosticsSlotTemplate> existing = slotRepository.findByBranchIdOrderByStartTimeAsc(branch.getId());
            if (!existing.isEmpty()) {
                continue;
            }
            List<UpsertDiagnosticsBranchRequest.SlotInput> hourly = new ArrayList<>();
            for (int hour = 0; hour < 24; hour++) {
                hourly.add(hourlySlotInput(hour));
            }
            replaceSlots(branch.getId(), hourly);
        }
    }

    private static final int DEFAULT_SLOT_CAPACITY = 5;

    private static UpsertDiagnosticsBranchRequest.SlotInput hourlySlotInput(int startHour) {
        int endHour = (startHour + 1) % 24;
        String start = String.format("%02d:00", startHour);
        String end = String.format("%02d:00", endHour);
        UpsertDiagnosticsBranchRequest.SlotInput input = new UpsertDiagnosticsBranchRequest.SlotInput();
        input.setLabel(hourlySlotLabel(startHour));
        input.setStartTime(start);
        input.setEndTime(end);
        input.setCapacity(DEFAULT_SLOT_CAPACITY);
        input.setActive(true);
        return input;
    }

    private static String hourlySlotLabel(int startHour) {
        return formatHour12(startHour) + "–" + formatHour12((startHour + 1) % 24);
    }

    private static String formatHour12(int hour) {
        int h = ((hour % 24) + 24) % 24;
        if (h == 0) {
            return "12 am";
        }
        if (h < 12) {
            return h + " am";
        }
        if (h == 12) {
            return "12 pm";
        }
        return (h - 12) + " pm";
    }

    private void applyBranchSlotBlocks(DiagnosticsBranch branch, UpsertDiagnosticsBranchRequest request) {
        if (request.getBlockedSlotsByDate() != null) {
            branch.setBlockedSlotsByDate(
                    request.getBlockedSlotsByDate().isBlank() ? "{}" : request.getBlockedSlotsByDate().trim());
        }
        if (request.getBlockedSlotDate() != null && request.getBlockedSlotIds() != null) {
            String raw = branch.getBlockedSlotsByDate() == null ? "{}" : branch.getBlockedSlotsByDate();
            branch.setBlockedSlotsByDate(
                    SlotBlocksByDate.putForDate(raw, request.getBlockedSlotDate(), request.getBlockedSlotIds()));
        }
    }

    private void replaceSlots(UUID branchId, List<UpsertDiagnosticsBranchRequest.SlotInput> slots) {
        if (slots == null) {
            return;
        }
        List<DiagnosticsSlotTemplate> existing = slotRepository.findByBranchIdOrderByStartTimeAsc(branchId);
        java.util.Set<UUID> kept = new java.util.HashSet<>();
        for (UpsertDiagnosticsBranchRequest.SlotInput input : slots) {
            if (input.getLabel() == null || input.getStartTime() == null || input.getEndTime() == null) {
                continue;
            }
            DiagnosticsSlotTemplate slot = null;
            if (input.getId() != null) {
                slot = existing.stream().filter(s -> s.getId().equals(input.getId())).findFirst().orElse(null);
            }
            if (slot == null) {
                slot = DiagnosticsSlotTemplate.builder().branchId(branchId).build();
            }
            slot.setLabel(trim(input.getLabel()));
            slot.setStartTime(LocalTime.parse(input.getStartTime().trim(), HM));
            slot.setEndTime(LocalTime.parse(input.getEndTime().trim(), HM));
            slot.setCapacity(input.getCapacity() == null ? DEFAULT_SLOT_CAPACITY : Math.max(1, input.getCapacity()));
            slot.setActive(input.getActive() == null || input.getActive());
            slotRepository.save(slot);
            kept.add(slot.getId());
        }
        for (DiagnosticsSlotTemplate row : existing) {
            if (!kept.contains(row.getId())) {
                slotRepository.delete(row);
            }
        }
    }

    private DiagnosticsTest mapTest(DiagnosticsTest test, UUID vendorId, UpsertDiagnosticsTestRequest request) {
        test.setVendorId(vendorId);
        test.setCode(trim(request.getCode()));
        test.setName(trim(request.getName()));
        test.setPrice(money(request.getPrice()));
        test.setFastingNote(trim(request.getFastingNote()));
        if (request.getPrescriptionRequired() != null) {
            test.setPrescriptionRequired(request.getPrescriptionRequired());
        }
        if (request.getHomeCollection() != null) {
            test.setHomeCollection(request.getHomeCollection());
        }
        if (request.getActive() != null) {
            test.setActive(request.getActive());
        }
        if (request.getSortOrder() != null) {
            test.setSortOrder(request.getSortOrder());
        }
        return test;
    }

    private DiagnosticsPackage mapPackage(DiagnosticsPackage pkg, UUID vendorId, UpsertDiagnosticsPackageRequest request) {
        pkg.setVendorId(vendorId);
        pkg.setCode(trim(request.getCode()));
        pkg.setName(trim(request.getName()));
        String desc = trim(request.getDescription());
        pkg.setDescription(desc == null || desc.isEmpty() ? null : desc);
        pkg.setPrice(money(request.getPrice()));
        if (request.getActive() != null) {
            pkg.setActive(request.getActive());
        }
        if (request.getSortOrder() != null) {
            pkg.setSortOrder(request.getSortOrder());
        }
        return pkg;
    }

    private void replacePackageMembers(UUID vendorId, UUID packageId, List<UUID> testIds) {
        if (testIds == null || testIds.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Package must include at least one test");
        }
        List<UUID> unique = testIds.stream().filter(Objects::nonNull).distinct().toList();
        for (UUID testId : unique) {
            testRepository.findByIdAndVendorId(testId, vendorId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid test for package: " + testId));
        }
        packageMemberRepository.deleteByPackageId(packageId);
        for (UUID testId : unique) {
            packageMemberRepository.save(DiagnosticsPackageMember.builder()
                    .packageId(packageId)
                    .testId(testId)
                    .build());
        }
    }

    private void requireDiagnosticsVendor(UUID vendorId) {
        Vendor vendor = requireVendor(vendorId);
        if (!isDiagnosticsVendor(vendor, offeringsById())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Vendor is not a diagnostics lab");
        }
    }

    private void applyProfile(DiagnosticsProfile profile, UpsertDiagnosticsProfileRequest request) {
        if (request.getEnabled() != null) {
            profile.setEnabled(request.getEnabled());
        }
        if (request.getBookable() != null) {
            profile.setBookable(request.getBookable());
        }
        if (request.getHomeCollectionFee() != null) {
            profile.setHomeCollectionFee(money(request.getHomeCollectionFee()));
        }
    }

    private StaffContext requireWriteAccess(UUID userId) {
        StaffContext ctx = resolveStaffContext(userId);
        if (ctx.vendorOwner() || DiagnosticsConstants.ROLE_LAB_ADMIN.equals(ctx.roleType())) {
            return ctx;
        }
        if (DiagnosticsConstants.ROLE_LAB_STAFF.equals(ctx.roleType())
                && DiagnosticsConstants.TITLE_MANAGER.equalsIgnoreCase(nullToEmpty(ctx.title()))) {
            return ctx;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "You cannot change lab configuration");
    }

    private StaffContext requireStaffAdmin(UUID userId) {
        StaffContext ctx = resolveStaffContext(userId);
        if (ctx.vendorOwner() || DiagnosticsConstants.ROLE_LAB_ADMIN.equals(ctx.roleType())) {
            return ctx;
        }
        if (DiagnosticsConstants.ROLE_LAB_STAFF.equals(ctx.roleType())
                && DiagnosticsConstants.TITLE_MANAGER.equalsIgnoreCase(nullToEmpty(ctx.title()))) {
            return ctx;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Only lab admin or manager can manage staff");
    }

    @Transactional
    public void syncFieldAgentFromDelivery(SyncFieldAgentRequest request) {
        Vendor vendor = requireVendor(request.getVendorId());
        if (!isDiagnosticsVendor(vendor, offeringsById())) {
            return;
        }
        String labTitle = normalizeLabAgentTitle(trim(request.getLabTitle()));
        Optional<DiagnosticsStaff> existingByUser = staffRepository.findByUserId(request.getUserId())
                .filter(s -> s.getVendorId().equals(vendor.getId()));
        enforceManagerLimit(vendor.getId(), labTitle, existingByUser.map(DiagnosticsStaff::getId).orElse(null));
        boolean collectionCapable = Boolean.TRUE.equals(request.getCollectionCapable())
                || "COLLECTION_AGENT".equalsIgnoreCase(labTitle)
                || "MANAGER".equalsIgnoreCase(labTitle);
        DiagnosticsStaff staff = existingByUser.orElseGet(DiagnosticsStaff::new);
        boolean created = staff.getId() == null;
        staff.setVendorId(vendor.getId());
        staff.setUserId(request.getUserId());
        staff.setPhone(normalizePhone(request.getPhone()));
        staff.setDisplayName(trim(request.getDisplayName()));
        staff.setRoleType(DiagnosticsConstants.ROLE_LAB_STAFF);
        staff.setTitle(labTitle);
        staff.setCollectionCapable(collectionCapable);
        staff.setActive(request.isDeliveryActive());
        if (created) {
            staff.setCreatedBy(request.getUserId());
        }
        staff.setUpdatedBy(request.getUserId());
        staffRepository.save(staff);
        userClient.bindVendorContext(request.getUserId(), vendor.getTownId(), vendor.getId());
    }

    private void enforceManagerLimit(UUID vendorId, String title, UUID updatingStaffId) {
        if (!isManagerTitle(title)) {
            return;
        }
        long count = staffRepository.findByVendorIdOrderByDisplayNameAsc(vendorId).stream()
                .filter(s -> s.isActive() && isManagerTitle(s.getTitle()))
                .filter(s -> updatingStaffId == null || !s.getId().equals(updatingStaffId))
                .count();
        if (count >= DiagnosticsConstants.MAX_ACTIVE_MANAGERS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At most 4 active managers are allowed");
        }
    }

    private void validateStaffRequest(UpsertDiagnosticsStaffRequest request, boolean create) {
        if (create && (request.getPassword() == null || request.getPassword().isBlank())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Password is required for new staff login");
        }
        normalizeRole(request.getRoleType());
    }

    private void audit(UUID vendorId, UUID actorStaffId, String eventType, Map<String, Object> payload) {
        auditRepository.save(DiagnosticsStaffAudit.builder()
                .vendorId(vendorId)
                .actorStaffId(actorStaffId)
                .eventType(eventType)
                .payload(payload == null ? Map.of() : new LinkedHashMap<>(payload))
                .build());
    }

    private static Map<String, Object> staffPayload(DiagnosticsStaff staff) {
        Map<String, Object> map = new HashMap<>();
        map.put("staffId", staff.getId());
        map.put("userId", staff.getUserId());
        map.put("roleType", staff.getRoleType());
        map.put("title", staff.getTitle());
        map.put("active", staff.isActive());
        return map;
    }

    private Vendor requireVendor(UUID vendorId) {
        return vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
    }

    private static boolean isDiagnosticsVendor(Vendor vendor, Map<UUID, ServiceOffering> offerings) {
        if (vendor.getServiceId() == null) {
            return false;
        }
        ServiceOffering offering = offerings.get(vendor.getServiceId());
        return CatalogListingPolicy.isDiagnosticsService(offering == null ? null : offering.getName());
    }

    private Map<UUID, ServiceOffering> offeringsById() {
        return offeringRepository.findAll().stream()
                .collect(Collectors.toMap(ServiceOffering::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
    }

    private static String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "roleType is required");
        }
        String upper = role.trim().toUpperCase();
        if (!DiagnosticsConstants.ROLE_LAB_ADMIN.equals(upper) && !DiagnosticsConstants.ROLE_LAB_STAFF.equals(upper)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "roleType must be LAB_ADMIN or LAB_STAFF");
        }
        return upper;
    }

    private static String normalizePhone(String phone) {
        String digits = IndianMobilePhones.firstTenDigit(phone, phone);
        if (digits == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Enter a valid 10-digit mobile number");
        }
        return digits;
    }

    private static BigDecimal radius(BigDecimal value) {
        if (value == null || value.signum() <= 0) {
            return new BigDecimal("5.00");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private UUID resolveVendorStaffUserId(String phone, String password, String firstName, UUID townId) {
        try {
            return userClient.createVendorUser(phone, password, firstName, townId);
        } catch (BusinessException ex) {
            if (ex.getErrorCode() != ErrorCode.CONFLICT) {
                throw ex;
            }
            UserClient.UserProfileDto profile = userClient.findUserByPhone(phone);
            requireVendorLoginForStaff(profile);
            return profile.id();
        }
    }

    private static void requireVendorLoginForStaff(UserClient.UserProfileDto profile) {
        if (profile.roles() == null) {
            throw new BusinessException(ErrorCode.CONFLICT, "This mobile cannot be used for lab staff login");
        }
        boolean allowed = profile.roles().stream().anyMatch(r ->
                "VENDOR".equalsIgnoreCase(r) || "DELIVERY_AGENT".equalsIgnoreCase(r));
        if (!allowed) {
            String role = profile.roles().isEmpty()
                    ? "another account type"
                    : profile.roles().get(0).replace('_', ' ').toLowerCase();
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "This mobile is already used for a " + role + ". Lab staff need a different phone number.");
        }
    }

    private static boolean isManagerTitle(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String t = title.trim();
        return "MANAGER".equalsIgnoreCase(t) || DiagnosticsConstants.TITLE_MANAGER.equalsIgnoreCase(t);
    }

    private static String normalizeLabAgentTitle(String labTitle) {
        if (labTitle == null || labTitle.isBlank()) {
            return "COLLECTION_AGENT";
        }
        String t = labTitle.trim().toUpperCase();
        if ("MANAGER".equals(t) || "LAB_TECHNICIAN".equals(t) || "COLLECTION_AGENT".equals(t)) {
            return t;
        }
        return "COLLECTION_AGENT";
    }

    private void applyStaffFields(
            DiagnosticsStaff staff,
            UpsertDiagnosticsStaffRequest request,
            String displayName,
            String phone) {
        staff.setPhone(phone);
        staff.setDisplayName(displayName);
        staff.setRoleType(normalizeRole(request.getRoleType()));
        staff.setTitle(trim(request.getTitle()));
        staff.setCollectionCapable(Boolean.TRUE.equals(request.getCollectionCapable()));
    }

    private DiagnosticsTest resolveTestForWrite(UUID vendorId, UUID testId, UpsertDiagnosticsTestRequest request) {
        if (testId != null) {
            return testRepository.findByIdAndVendorId(testId, vendorId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Test not found"));
        }
        String code = trim(request.getCode());
        if (code != null && !code.isBlank()) {
            return testRepository.findFirstByVendorIdAndCodeIgnoreCaseOrderBySortOrderAscNameAsc(vendorId, code)
                    .orElseGet(DiagnosticsTest::new);
        }
        return new DiagnosticsTest();
    }

    private DiagnosticsPackage resolvePackageForWrite(UUID vendorId, UUID packageId, UpsertDiagnosticsPackageRequest request) {
        if (packageId != null) {
            return packageRepository.findByIdAndVendorId(packageId, vendorId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Package not found"));
        }
        String code = trim(request.getCode());
        if (code != null && !code.isBlank()) {
            return packageRepository.findFirstByVendorIdAndCodeIgnoreCaseOrderBySortOrderAscNameAsc(vendorId, code)
                    .orElseGet(DiagnosticsPackage::new);
        }
        return new DiagnosticsPackage();
    }

    private void deactivateDuplicateTests(UUID vendorId, String code, UUID keepId) {
        if (code == null || code.isBlank() || keepId == null) {
            return;
        }
        for (DiagnosticsTest row : testRepository.findByVendorIdAndCodeIgnoreCase(vendorId, code)) {
            if (!keepId.equals(row.getId()) && row.isActive()) {
                row.setActive(false);
                testRepository.save(row);
            }
        }
    }

    private void deactivateDuplicatePackages(UUID vendorId, String code, UUID keepId) {
        if (code == null || code.isBlank() || keepId == null) {
            return;
        }
        for (DiagnosticsPackage row : packageRepository.findByVendorIdAndCodeIgnoreCase(vendorId, code)) {
            if (!keepId.equals(row.getId()) && row.isActive()) {
                row.setActive(false);
                packageRepository.save(row);
            }
        }
    }

    private static List<DiagnosticsTest> dedupeCatalogTests(List<DiagnosticsTest> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        Map<String, DiagnosticsTest> byKey = new LinkedHashMap<>();
        List<DiagnosticsTest> custom = new ArrayList<>();
        for (DiagnosticsTest row : rows) {
            String key = catalogTestKey(row);
            if (key.startsWith("NAME:")) {
                if (custom.stream().noneMatch(c -> catalogTestKey(c).equals(key))) {
                    custom.add(row);
                }
                continue;
            }
            byKey.merge(key, row, DiagnosticsVendorService::pickPreferredTest);
        }
        List<DiagnosticsTest> out = new ArrayList<>(byKey.values());
        out.addAll(custom);
        out.sort(Comparator
                .comparingInt(DiagnosticsTest::getSortOrder)
                .thenComparing(t -> t.getName() == null ? "" : t.getName(), String.CASE_INSENSITIVE_ORDER));
        return out;
    }

    private static List<DiagnosticsPackage> dedupeCatalogPackages(List<DiagnosticsPackage> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        Map<String, DiagnosticsPackage> byKey = new LinkedHashMap<>();
        List<DiagnosticsPackage> custom = new ArrayList<>();
        for (DiagnosticsPackage row : rows) {
            String key = catalogPackageKey(row);
            if (key.startsWith("NAME:")) {
                if (custom.stream().noneMatch(c -> catalogPackageKey(c).equals(key))) {
                    custom.add(row);
                }
                continue;
            }
            byKey.merge(key, row, DiagnosticsVendorService::pickPreferredPackage);
        }
        List<DiagnosticsPackage> out = new ArrayList<>(byKey.values());
        out.addAll(custom);
        out.sort(Comparator
                .comparingInt(DiagnosticsPackage::getSortOrder)
                .thenComparing(p -> p.getName() == null ? "" : p.getName(), String.CASE_INSENSITIVE_ORDER));
        return out;
    }

    private static String catalogTestKey(DiagnosticsTest test) {
        String code = test.getCode();
        if (code != null && !code.isBlank()) {
            return code.trim().toUpperCase(Locale.ROOT);
        }
        return "NAME:" + (test.getName() == null ? "" : test.getName().trim().toUpperCase(Locale.ROOT));
    }

    private static String catalogPackageKey(DiagnosticsPackage pkg) {
        String code = pkg.getCode();
        if (code != null && !code.isBlank()) {
            return code.trim().toUpperCase(Locale.ROOT);
        }
        return "NAME:" + (pkg.getName() == null ? "" : pkg.getName().trim().toUpperCase(Locale.ROOT));
    }

    private static DiagnosticsTest pickPreferredTest(DiagnosticsTest left, DiagnosticsTest right) {
        if (left.isActive() != right.isActive()) {
            return left.isActive() ? left : right;
        }
        if (left.getSortOrder() != right.getSortOrder()) {
            return left.getSortOrder() <= right.getSortOrder() ? left : right;
        }
        BigDecimal lp = left.getPrice() == null ? BigDecimal.ZERO : left.getPrice();
        BigDecimal rp = right.getPrice() == null ? BigDecimal.ZERO : right.getPrice();
        if (lp.signum() != rp.signum()) {
            return lp.signum() > 0 ? left : right;
        }
        return left;
    }

    private static DiagnosticsPackage pickPreferredPackage(DiagnosticsPackage left, DiagnosticsPackage right) {
        if (left.isActive() != right.isActive()) {
            return left.isActive() ? left : right;
        }
        if (left.getSortOrder() != right.getSortOrder()) {
            return left.getSortOrder() <= right.getSortOrder() ? left : right;
        }
        BigDecimal lp = left.getPrice() == null ? BigDecimal.ZERO : left.getPrice();
        BigDecimal rp = right.getPrice() == null ? BigDecimal.ZERO : right.getPrice();
        if (lp.signum() != rp.signum()) {
            return lp.signum() > 0 ? left : right;
        }
        return left;
    }

    private static DiagnosticsStaffSessionResponse staffSessionFromContext(StaffContext ctx, String displayName) {
        String roleType = ctx.roleType() == null ? "" : ctx.roleType();
        String title = nullToEmpty(ctx.title());
        boolean isAdmin = ctx.vendorOwner() || DiagnosticsConstants.ROLE_LAB_ADMIN.equalsIgnoreCase(roleType);
        boolean isManager = isManagerTitle(title);
        boolean isTech = "LAB_TECHNICIAN".equalsIgnoreCase(title);
        return DiagnosticsStaffSessionResponse.builder()
                .staffId(ctx.staffId())
                .roleType(roleType)
                .title(ctx.title())
                .collectionCapable(ctx.collectionCapable())
                .displayName(displayName)
                .vendorOwner(ctx.vendorOwner())
                .canManageStaff(isAdmin)
                .canManageCatalog(isAdmin || isManager)
                .canDispatch(isAdmin || isManager)
                .canLabDesk(isAdmin || isManager || isTech)
                .canReadAudit(true)
                .build();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String formatTime(LocalTime time) {
        return time == null ? null : time.format(HM);
    }
}
