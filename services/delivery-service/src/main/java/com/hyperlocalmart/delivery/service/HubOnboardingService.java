package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.TownClient;
import com.hyperlocalmart.delivery.client.UserClient;
import com.hyperlocalmart.delivery.dto.request.CreateHubRequest;
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
                    .build();
            admin.setCreatedBy(actorId);
            admin.setUpdatedBy(actorId);
            hubAdminRepository.save(admin);

            userClient.bindHubContext(adminUserId, townId, hub.getId());

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
                .temporaryPassword(temporaryPassword)
                .build();
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
