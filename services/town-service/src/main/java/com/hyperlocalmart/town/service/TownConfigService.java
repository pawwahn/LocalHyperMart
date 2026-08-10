package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.request.UpdateTownConfigRequest;
import com.hyperlocalmart.town.dto.response.TownOperationalConfigResponse;
import com.hyperlocalmart.town.entity.TownConfig;
import com.hyperlocalmart.town.repository.TownConfigRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TownConfigService {

    private static final String OPERATIONAL_KEY = "operational";
    private static final BigDecimal DEFAULT_MIN_ORDER = new BigDecimal("199");
    private static final String MODE_DEFAULT = "DEFAULT";
    private static final String MODE_SLAB = "SLAB";

    private final TownConfigRepository townConfigRepository;
    private final TownRepository townRepository;
    private final PlatformSettingsService platformSettingsService;

    @Transactional(readOnly = true)
    public TownOperationalConfigResponse getOperationalConfig(UUID townId) {
        return townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, OPERATIONAL_KEY)
                .map(this::toOperational)
                .orElseGet(this::defaultOperational);
    }

    /**
     * Ensures every new town has an operational config row (min order, etc.)
     * so N-town launches do not rely on seed data for one pilot town.
     */
    @Transactional
    public void ensureDefaultOperationalConfig(UUID townId) {
        boolean exists = townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, OPERATIONAL_KEY)
                .isPresent();
        if (exists) {
            return;
        }
        Map<String, Object> value = defaultConfigValue();
        Instant now = Instant.now();
        TownConfig config = TownConfig.builder()
                .townId(townId)
                .configKey(OPERATIONAL_KEY)
                .configValue(value)
                .effectiveFrom(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        townConfigRepository.save(config);
    }

    @Transactional
    public TownOperationalConfigResponse updateOperationalConfig(UUID townId, UpdateTownConfigRequest request) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        ensureDefaultOperationalConfig(townId);

        TownConfig config = townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, OPERATIONAL_KEY)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Town config not found"));

        Map<String, Object> value = new LinkedHashMap<>(
                config.getConfigValue() != null ? config.getConfigValue() : defaultConfigValue());

        if (request.getMinOrderValue() != null) {
            if (request.getMinOrderValue().compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "minOrderValue must be >= 0");
            }
            value.put("minOrderValue", request.getMinOrderValue().setScale(2, RoundingMode.HALF_UP));
        }

        String mode = request.getDeliveryMode() != null
                ? request.getDeliveryMode().trim().toUpperCase()
                : String.valueOf(value.getOrDefault("deliveryMode", MODE_DEFAULT));
        if (!MODE_DEFAULT.equals(mode) && !MODE_SLAB.equals(mode)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "deliveryMode must be DEFAULT or SLAB");
        }
        value.put("deliveryMode", mode);

        List<Map<String, Object>> slabs = normalizeSlabs(request.getDeliverySlabs(), mode);
        value.put("deliverySlabs", slabs);

        config.setConfigValue(value);
        config.setUpdatedAt(Instant.now());
        townConfigRepository.save(config);
        return toOperational(config);
    }

    /**
     * Resolve delivery fee for a town + order value.
     * DEFAULT → platform flat fee; SLAB → matching slab (fallback platform).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> resolveDeliveryFee(UUID townId, BigDecimal orderValue) {
        TownOperationalConfigResponse config = getOperationalConfig(townId);
        BigDecimal platformFee = platformSettingsService.resolveDeliveryFee();
        BigDecimal value = orderValue == null ? BigDecimal.ZERO : orderValue.max(BigDecimal.ZERO);

        if (MODE_SLAB.equalsIgnoreCase(config.getDeliveryMode())
                && config.getDeliverySlabs() != null
                && !config.getDeliverySlabs().isEmpty()) {
            for (TownOperationalConfigResponse.DeliverySlabResponse slab : config.getDeliverySlabs()) {
                BigDecimal min = slab.getMinOrderValue() == null ? BigDecimal.ZERO : slab.getMinOrderValue();
                BigDecimal max = slab.getMaxOrderValue();
                boolean geMin = value.compareTo(min) >= 0;
                boolean ltMax = max == null || value.compareTo(max) <= 0;
                if (geMin && ltMax) {
                    BigDecimal fee = slab.getDeliveryFee() == null ? platformFee : slab.getDeliveryFee();
                    return Map.of(
                            "deliveryFee", fee,
                            "deliveryMode", MODE_SLAB,
                            "source", "TOWN_SLAB");
                }
            }
            return Map.of(
                    "deliveryFee", platformFee,
                    "deliveryMode", MODE_SLAB,
                    "source", "PLATFORM_FALLBACK");
        }

        return Map.of(
                "deliveryFee", platformFee,
                "deliveryMode", MODE_DEFAULT,
                "source", "PLATFORM_DEFAULT");
    }

    private List<Map<String, Object>> normalizeSlabs(
            List<UpdateTownConfigRequest.DeliverySlabRequest> input,
            String mode) {
        if (!MODE_SLAB.equals(mode)) {
            return List.of();
        }
        if (input == null || input.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Add at least one delivery slab for SLAB mode");
        }

        List<UpdateTownConfigRequest.DeliverySlabRequest> sorted = new ArrayList<>(input);
        sorted.sort(Comparator.comparing(
                s -> s.getMinOrderValue() == null ? BigDecimal.ZERO : s.getMinOrderValue()));

        List<Map<String, Object>> out = new ArrayList<>();
        BigDecimal prevMax = null;
        for (int i = 0; i < sorted.size(); i++) {
            UpdateTownConfigRequest.DeliverySlabRequest slab = sorted.get(i);
            BigDecimal min = slab.getMinOrderValue() == null ? BigDecimal.ZERO : slab.getMinOrderValue();
            BigDecimal max = slab.getMaxOrderValue();
            BigDecimal fee = slab.getDeliveryFee();
            if (fee == null || fee.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Each slab needs a deliveryFee >= 0");
            }
            if (min.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Slab minOrderValue must be >= 0");
            }
            if (max != null && max.compareTo(min) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Slab maxOrderValue must be >= minOrderValue");
            }
            if (i == sorted.size() - 1 && max != null) {
                // allow last slab to have max, or open-ended — either is fine
            }
            if (prevMax != null && min.compareTo(prevMax) <= 0) {
                // soft overlap check: next min should be > previous max when previous has max
                // allow equality at boundary (e.g. 0-499, 500-null)
                if (min.compareTo(prevMax) < 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Delivery slabs overlap");
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("minOrderValue", min.setScale(2, RoundingMode.HALF_UP));
            row.put("maxOrderValue", max == null ? null : max.setScale(2, RoundingMode.HALF_UP));
            row.put("deliveryFee", fee.setScale(2, RoundingMode.HALF_UP));
            out.add(row);
            prevMax = max;
        }
        return out;
    }

    private TownOperationalConfigResponse defaultOperational() {
        return TownOperationalConfigResponse.builder()
                .minOrderValue(DEFAULT_MIN_ORDER)
                .deliveryMode(MODE_DEFAULT)
                .deliverySlabs(List.of())
                .build();
    }

    private Map<String, Object> defaultConfigValue() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("minOrderValue", DEFAULT_MIN_ORDER);
        value.put("deliveryMode", MODE_DEFAULT);
        value.put("deliverySlabs", List.of());
        value.put("readyForPickupAlertHours", 1);
        value.put("refundWorkingDays", 5);
        value.put("maxSmsPerOrder", 6);
        value.put("quietHours", Map.of("start", "22:00", "end", "08:00"));
        return value;
    }

    private TownOperationalConfigResponse toOperational(TownConfig config) {
        Map<String, Object> value = config.getConfigValue();
        Object minOrder = value != null ? value.get("minOrderValue") : null;
        BigDecimal minOrderValue = minOrder instanceof Number number
                ? BigDecimal.valueOf(number.doubleValue())
                : DEFAULT_MIN_ORDER;

        String mode = MODE_DEFAULT;
        if (value != null && value.get("deliveryMode") != null) {
            mode = String.valueOf(value.get("deliveryMode")).trim().toUpperCase();
            if (!MODE_SLAB.equals(mode)) {
                mode = MODE_DEFAULT;
            }
        }

        List<TownOperationalConfigResponse.DeliverySlabResponse> slabs = new ArrayList<>();
        if (value != null && value.get("deliverySlabs") instanceof List<?> rawList) {
            for (Object item : rawList) {
                if (!(item instanceof Map<?, ?> map)) continue;
                slabs.add(TownOperationalConfigResponse.DeliverySlabResponse.builder()
                        .minOrderValue(asDecimal(map.get("minOrderValue")))
                        .maxOrderValue(asDecimal(map.get("maxOrderValue")))
                        .deliveryFee(asDecimal(map.get("deliveryFee")))
                        .build());
            }
        }

        return TownOperationalConfigResponse.builder()
                .minOrderValue(minOrderValue)
                .deliveryMode(mode)
                .deliverySlabs(slabs)
                .build();
    }

    private BigDecimal asDecimal(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new BigDecimal(s.trim()).setScale(2, RoundingMode.HALF_UP);
        }
        return null;
    }
}
