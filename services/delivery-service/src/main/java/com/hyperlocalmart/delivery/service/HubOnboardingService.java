package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.TownClient;
import com.hyperlocalmart.delivery.client.UserClient;
import com.hyperlocalmart.delivery.dto.request.CreateHubRequest;
import com.hyperlocalmart.delivery.dto.request.UpdateHubRequest;
import com.hyperlocalmart.delivery.dto.response.AdminHubResponse;
import com.hyperlocalmart.delivery.entity.DeliveryHub;
import com.hyperlocalmart.delivery.entity.HubAdmin;
import com.hyperlocalmart.delivery.repository.DeliveryHubRepository;
import com.hyperlocalmart.delivery.repository.HubAdminRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class HubOnboardingService {

    private static final String HUB_ACTIVE = "ACTIVE";
    private static final String TEMP_PASSWORD_PREFIX = "HlM@";

    private final DeliveryHubRepository deliveryHubRepository;
    private final HubAdminRepository hubAdminRepository;
    private final TownClient townClient;
    private final UserClient userClient;

    @Transactional(readOnly = true)
    public List<AdminHubResponse> listHubs() {
        List<AdminHubResponse> items = new ArrayList<>();
        for (DeliveryHub hub : deliveryHubRepository.findAllByOrderByNameAsc()) {
            HubAdmin admin = hubAdminRepository.findByHubId(hub.getId()).orElse(null);
            items.add(toResponse(hub, admin, hub.getPhone(), null));
        }
        return items;
    }

    /**
     * Creates a delivery hub for any enabled town and provisions its hub-admin login.
     * One hub per town (DB unique). Scales to N towns without seed SQL.
     */
    @Transactional
    public AdminHubResponse createHub(UUID actorId, CreateHubRequest request) {
        UUID townId = request.getTownId();
        townClient.requireEnabledTown(townId);

        if (deliveryHubRepository.existsByTownId(townId)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "This town already has a delivery hub — one hub per town");
        }

        String hubPhone = request.getPhone().trim();
        String adminPhone = request.getAdminPhone() == null || request.getAdminPhone().isBlank()
                ? hubPhone
                : request.getAdminPhone().trim();
        String hubName = request.getName().trim();
        String firstName = request.getAdminFirstName() == null || request.getAdminFirstName().isBlank()
                ? hubName
                : request.getAdminFirstName().trim();
        String lastName = blankToNull(request.getAdminLastName());

        String password;
        if (request.getAdminPassword() == null || request.getAdminPassword().isBlank()) {
            password = TEMP_PASSWORD_PREFIX + adminPhone.substring(adminPhone.length() - 4);
        } else {
            password = request.getAdminPassword();
            if (password.length() < 8) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Admin password must be at least 8 characters");
            }
        }

        DeliveryHub hub = DeliveryHub.builder()
                .townId(townId)
                .name(hubName)
                .address(blankToNull(request.getAddress()))
                .phone(hubPhone)
                .status(HUB_ACTIVE)
                .build();
        hub.setCreatedBy(actorId);
        hub.setUpdatedBy(actorId);
        deliveryHubRepository.save(hub);

        UUID adminUserId = userClient.createHubAdminUser(adminPhone, password, firstName, lastName, townId);
        try {
            if (hubAdminRepository.existsByUserId(adminUserId)) {
                throw new BusinessException(ErrorCode.CONFLICT, "User is already linked to a hub admin");
            }

            HubAdmin admin = HubAdmin.builder()
                    .hubId(hub.getId())
                    .userId(adminUserId)
                    .status(HUB_ACTIVE)
                    .govtIdType(request.getGovtIdType().trim().toUpperCase())
                    .govtIdNumber(request.getGovtIdNumber().replaceAll("\\s", "").trim())
                    .reference1Name(request.getReference1Name().trim())
                    .reference1Phone(request.getReference1Phone().trim())
                    .reference2Name(request.getReference2Name().trim())
                    .reference2Phone(request.getReference2Phone().trim())
                    .build();
            admin.setCreatedBy(actorId);
            admin.setUpdatedBy(actorId);
            hubAdminRepository.save(admin);

            userClient.bindHubContext(adminUserId, townId, hub.getId());
            townClient.appendAdminAudit(
                    "hubs",
                    "CREATE_HUB",
                    "Created hub " + hubName,
                    actorId,
                    townId,
                    hub.getId());

            return toResponse(hub, admin, adminPhone, password);
        } catch (RuntimeException ex) {
            try {
                userClient.updateUserStatus(adminUserId, "DISABLED");
            } catch (Exception cleanup) {
                log.warn("Failed to roll back hub admin login {} after create failure: {}",
                        adminUserId, cleanup.getMessage());
            }
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public AdminHubResponse getHub(UUID hubId) {
        DeliveryHub hub = deliveryHubRepository.findById(hubId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));
        HubAdmin admin = hubAdminRepository.findByHubId(hub.getId()).orElse(null);
        return toResponse(hub, admin, hub.getPhone(), null);
    }

    @Transactional
    public AdminHubResponse updateHub(UUID actorId, UUID hubId, UpdateHubRequest request) {
        DeliveryHub hub = deliveryHubRepository.findById(hubId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));
        HubAdmin admin = hubAdminRepository.findByHubId(hub.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub admin not found"));

        String nextName = request.getName().trim();
        String nextAddress = blankToNull(request.getAddress());
        String nextPhone = request.getPhone().trim();
        String nextStatus = request.getStatus().trim().toUpperCase();
        String nextGovtType = request.getGovtIdType().trim().toUpperCase();
        String nextGovtNumber = replaceGovtId(request.getGovtIdNumber(), admin.getGovtIdNumber(), nextGovtType);
        String nextR1Name = request.getReference1Name().trim();
        String nextR1Phone = request.getReference1Phone().trim();
        String nextR2Name = request.getReference2Name().trim();
        String nextR2Phone = request.getReference2Phone().trim();

        if (nextR1Phone.equals(nextR2Phone)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Reference 1 and reference 2 must use different phones");
        }
        if (nextR1Phone.equals(nextPhone) || nextR2Phone.equals(nextPhone)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Reference phones must be different from the hub phone");
        }

        List<String> changes = new ArrayList<>();
        addChange(changes, "name", hub.getName(), nextName);
        addChange(changes, "address", nvl(hub.getAddress()), nvl(nextAddress));
        addChange(changes, "phone", hub.getPhone(), nextPhone);
        addChange(changes, "status", hub.getStatus(), nextStatus);
        addChange(changes, "ID type", admin.getGovtIdType(), nextGovtType);
        if (!Objects.equals(nvl(admin.getGovtIdNumber()), nvl(nextGovtNumber))) {
            changes.add("ID number updated");
        }
        addChange(changes, "ref 1 name", admin.getReference1Name(), nextR1Name);
        addChange(changes, "ref 1 phone", admin.getReference1Phone(), nextR1Phone);
        addChange(changes, "ref 2 name", admin.getReference2Name(), nextR2Name);
        addChange(changes, "ref 2 phone", admin.getReference2Phone(), nextR2Phone);

        if (changes.isEmpty()) {
            return toResponse(hub, admin, hub.getPhone(), null);
        }

        hub.setName(nextName);
        hub.setAddress(nextAddress);
        hub.setPhone(nextPhone);
        hub.setStatus(nextStatus);
        hub.setUpdatedBy(actorId);
        deliveryHubRepository.save(hub);

        admin.setGovtIdType(nextGovtType);
        admin.setGovtIdNumber(nextGovtNumber);
        admin.setReference1Name(nextR1Name);
        admin.setReference1Phone(nextR1Phone);
        admin.setReference2Name(nextR2Name);
        admin.setReference2Phone(nextR2Phone);
        admin.setStatus(nextStatus);
        admin.setUpdatedBy(actorId);
        hubAdminRepository.save(admin);

        String summary = nextName + " · " + String.join(", ", changes);
        if (summary.length() > 500) {
            summary = summary.substring(0, 500);
        }
        townClient.appendAdminAudit("hubs", "UPDATE_HUB", summary, actorId, hub.getTownId(), hub.getId());
        return toResponse(hub, admin, hub.getPhone(), null);
    }

    private static String replaceGovtId(String incoming, String stored, String nextType) {
        String raw = incoming == null ? "" : incoming.replaceAll("\\s", "").trim();
        if (raw.isEmpty() || raw.contains("*")) {
            return stored;
        }
        if ("AADHAAR".equals(nextType) && !raw.matches("^\\d{12}$")) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Aadhaar number must be 12 digits");
        }
        if (raw.length() < 4) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Enter government ID number");
        }
        return raw;
    }

    private static void addChange(List<String> changes, String label, String before, String after) {
        String left = nvl(before);
        String right = nvl(after);
        if (!left.equals(right)) {
            changes.add(label + " " + (left.isEmpty() ? "—" : left) + " → " + (right.isEmpty() ? "—" : right));
        }
    }

    private static String nvl(String value) {
        return value == null ? "" : value.trim();
    }

    private static AdminHubResponse toResponse(
            DeliveryHub hub, HubAdmin admin, String adminPhone, String temporaryPassword) {
        return AdminHubResponse.builder()
                .hubId(hub.getId())
                .townId(hub.getTownId())
                .name(hub.getName())
                .address(hub.getAddress())
                .phone(hub.getPhone())
                .status(hub.getStatus())
                .adminUserId(admin == null ? null : admin.getUserId())
                .adminPhone(adminPhone)
                .govtIdType(admin == null ? null : admin.getGovtIdType())
                .govtIdNumber(admin == null ? null : maskGovtId(admin.getGovtIdNumber()))
                .reference1Name(admin == null ? null : admin.getReference1Name())
                .reference1Phone(admin == null ? null : admin.getReference1Phone())
                .reference2Name(admin == null ? null : admin.getReference2Name())
                .reference2Phone(admin == null ? null : admin.getReference2Phone())
                .temporaryPassword(temporaryPassword)
                .build();
    }

    /** Show only last 4 characters of government ID in API responses. */
    private static String maskGovtId(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 4) {
            return "****";
        }
        return "****" + trimmed.substring(trimmed.length() - 4);
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
