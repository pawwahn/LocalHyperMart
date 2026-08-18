package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.request.CreateTownRequest;
import com.hyperlocalmart.town.dto.request.UpdateTownStatusRequest;
import com.hyperlocalmart.town.dto.response.GeoCountryResponse;
import com.hyperlocalmart.town.dto.response.GeoStateResponse;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TownService {

    private final TownRepository townRepository;
    private final TownPincodeRepository townPincodeRepository;
    private final GeoCatalogService geoCatalogService;
    private final TownConfigService townConfigService;

    @Transactional(readOnly = true)
    public TownListResponse listTowns(TownStatus status, boolean includeDisabled) {
        return listTowns(status, includeDisabled, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public TownListResponse listTowns(
            TownStatus status,
            boolean includeDisabled,
            String q,
            Integer page,
            Integer size,
            Collection<UUID> ids) {
        if (ids != null && !ids.isEmpty()) {
            List<UUID> wanted = ids.stream().distinct().limit(200).toList();
            TownStatus required = includeDisabled ? status : (status != null ? status : TownStatus.ENABLED);
            List<TownListItemResponse> items = townRepository.findByIdIn(wanted).stream()
                    .filter(town -> required == null || town.getStatus() == required)
                    .sorted(Comparator.comparing(Town::getDisplayName, String.CASE_INSENSITIVE_ORDER))
                    .map(this::toListItem)
                    .toList();
            return TownListResponse.builder()
                    .items(items)
                    .total((long) items.size())
                    .hasMore(false)
                    .build();
        }

        String needle = q == null || q.isBlank() ? null : q.trim();
        if (size == null && needle == null) {
            List<Town> towns;
            if (includeDisabled && status == null) {
                towns = townRepository.findAllByOrderByDisplayNameAsc();
            } else {
                TownStatus effectiveStatus = status != null ? status : TownStatus.ENABLED;
                towns = townRepository.findByStatusOrderByDisplayNameAsc(effectiveStatus);
            }
            List<TownListItemResponse> items = towns.stream().map(this::toListItem).toList();
            return TownListResponse.builder()
                    .items(items)
                    .total((long) items.size())
                    .hasMore(false)
                    .build();
        }

        TownStatus filterStatus = includeDisabled ? status : (status != null ? status : TownStatus.ENABLED);
        int safeSize = Math.min(Math.max(size == null ? 80 : size, 1), 100);
        int safePage = page == null || page < 0 ? 0 : page;
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by("displayName"));
        Page<Town> result;
        if (needle == null) {
            result = filterStatus == null
                    ? townRepository.findAllByOrderByDisplayNameAsc(pageable)
                    : townRepository.findByStatusOrderByDisplayNameAsc(filterStatus, pageable);
        } else {
            result = townRepository.search(filterStatus, needle, pageable);
        }
        return TownListResponse.builder()
                .items(result.getContent().stream().map(this::toListItem).toList())
                .total(result.getTotalElements())
                .hasMore(result.hasNext())
                .build();
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
        GeoCountryResponse country = geoCatalogService.requireCountry(request.getCountryCode());
        GeoStateResponse region = geoCatalogService.requireState(country.getCode(), request.getStateCode());

        String townCode = request.getTownCode().trim().toUpperCase();
        String name = request.getName().trim();
        String state = region.getName();
        String stateCode = region.getCode().toUpperCase();
        String countryCode = country.getCode().toUpperCase();

        if (townRepository.existsByTownCodeIgnoreCaseAndStateCodeIgnoreCaseAndCountryCodeIgnoreCase(
                townCode, stateCode, countryCode)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Town code already exists for this state/country");
        }
        if (townRepository.existsByNameIgnoreCaseAndStateIgnoreCaseAndCountryCodeIgnoreCase(
                name, state, countryCode)) {
            throw new BusinessException(ErrorCode.CONFLICT, "A town with this name already exists in this state/country");
        }

        Town town = Town.builder()
                .name(name)
                .country(country.getName())
                .countryCode(countryCode)
                .state(state)
                .townCode(townCode)
                .stateCode(stateCode)
                .displayName(name + ", " + state)
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

        townConfigService.ensureDefaultOperationalConfig(town.getId());

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
                .state(town.getState())
                .stateCode(town.getStateCode())
                .country(town.getCountry())
                .countryCode(town.getCountryCode())
                .status(town.getStatus())
                .acceptingOrders(town.isAcceptingOrders())
                .build();
    }

    private TownDetailResponse toDetail(Town town, List<String> pincodes) {
        return TownDetailResponse.builder()
                .id(town.getId())
                .name(town.getName())
                .country(town.getCountry())
                .countryCode(town.getCountryCode())
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
