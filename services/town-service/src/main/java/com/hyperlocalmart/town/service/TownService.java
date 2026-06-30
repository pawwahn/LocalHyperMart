package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
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
    public TownListResponse listTowns(TownStatus status) {
        TownStatus effectiveStatus = status != null ? status : TownStatus.ENABLED;
        List<Town> towns = townRepository.findByStatusOrderByDisplayNameAsc(effectiveStatus);
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
