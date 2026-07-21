package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.request.CreateTownRequest;
import com.hyperlocalmart.town.dto.request.UpdateTownStatusRequest;
import com.hyperlocalmart.town.dto.response.TownDetailResponse;
import com.hyperlocalmart.town.dto.response.TownListItemResponse;
import com.hyperlocalmart.town.dto.response.TownListResponse;
import com.hyperlocalmart.town.dto.response.TownSummaryResponse;
import com.hyperlocalmart.town.entity.Town;
import com.hyperlocalmart.town.entity.TownPincode;
import com.hyperlocalmart.town.entity.TownStatus;
import com.hyperlocalmart.town.repository.TownPincodeRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TownService {

    private final TownRepository townRepository;
    private final TownPincodeRepository townPincodeRepository;

    @Transactional(readOnly = true)
    public TownListResponse listTowns(TownStatus status, boolean includeDisabled) {
        List<Town> towns;
        if (includeDisabled && status == null) {
            towns = townRepository.findAllByOrderByDisplayNameAsc();
        } else {
            TownStatus effectiveStatus = status != null ? status : TownStatus.ENABLED;
            towns = townRepository.findByStatusOrderByDisplayNameAsc(effectiveStatus);
        }
        List<TownListItemResponse> items = towns.stream().map(this::toListItem).toList();
        return TownListResponse.builder().items(items).build();
    }

    @Transactional(readOnly = true)
    public TownDetailResponse getTown(UUID townId) {
        Town town = townRepository.findById(townId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Town not found"));
        List<String> pincodes = townPincodeRepository.findByTownIdOrderByPincodeAsc(townId).stream()
                .map(TownPincode::getPincode)
                .toList();
        return toDetail(town, pincodes);
    }

    @Transactional
    public TownDetailResponse createTown(CreateTownRequest request, UUID actorId) {
        String code = request.getTownCode().trim().toUpperCase();
        if (townRepository.existsByTownCodeIgnoreCase(code)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Town code already exists");
        }
        Town town = Town.builder()
                .name(request.getName().trim())
                .state(request.getState().trim())
                .townCode(code)
                .stateCode(request.getStateCode().trim().toUpperCase())
                .displayName(request.getName().trim() + ", " + request.getState().trim())
                .coverageRadiusKm(request.getCoverageRadiusKm())
                .status(TownStatus.ENABLED)
                .build();
        town.setCreatedBy(actorId);
        town.setUpdatedBy(actorId);
        townRepository.save(town);

        for (String pin : request.getPincodes()) {
            if (pin == null || pin.isBlank()) {
                continue;
            }
            TownPincode row = TownPincode.builder()
                    .town(town)
                    .pincode(pin.trim())
                    .build();
            townPincodeRepository.save(row);
        }

        return getTown(town.getId());
    }

    @Transactional
    public TownDetailResponse updateStatus(UUID townId, UpdateTownStatusRequest request, UUID actorId) {
        Town town = townRepository.findById(townId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Town not found"));
        town.setStatus(request.getStatus());
        town.setUpdatedBy(actorId);
        townRepository.save(town);
        return getTown(townId);
    }

    @Transactional(readOnly = true)
    public boolean existsAndEnabled(UUID townId) {
        return townRepository.findById(townId)
                .map(t -> t.getStatus() == TownStatus.ENABLED)
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public TownSummaryResponse getTownSummary(UUID townId) {
        Town town = townRepository.findById(townId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Town not found"));
        return TownSummaryResponse.builder()
                .townCode(town.getTownCode())
                .stateCode(town.getStateCode())
                .displayName(town.getDisplayName())
                .build();
    }

    private TownListItemResponse toListItem(Town town) {
        return TownListItemResponse.builder()
                .id(town.getId())
                .displayName(town.getDisplayName())
                .townCode(town.getTownCode())
                .stateCode(town.getStateCode())
                .status(town.getStatus())
                .acceptingOrders(town.isAcceptingOrders())
                .build();
    }

    private TownDetailResponse toDetail(Town town, List<String> pincodes) {
        return TownDetailResponse.builder()
                .id(town.getId())
                .name(town.getName())
                .state(town.getState())
                .displayName(town.getDisplayName())
                .townCode(town.getTownCode())
                .stateCode(town.getStateCode())
                .coverageRadiusKm(town.getCoverageRadiusKm())
                .status(town.getStatus())
                .acceptingOrders(town.isAcceptingOrders())
                .pincodes(pincodes)
                .build();
    }
}
