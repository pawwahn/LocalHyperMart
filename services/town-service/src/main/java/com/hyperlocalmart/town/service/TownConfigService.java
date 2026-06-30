package com.hyperlocalmart.town.service;

import com.hyperlocalmart.town.dto.response.TownOperationalConfigResponse;
import com.hyperlocalmart.town.entity.TownConfig;
import com.hyperlocalmart.town.repository.TownConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TownConfigService {

    private static final String OPERATIONAL_KEY = "operational";
    private static final BigDecimal DEFAULT_MIN_ORDER = new BigDecimal("199");

    private final TownConfigRepository townConfigRepository;

    @Transactional(readOnly = true)
    public TownOperationalConfigResponse getOperationalConfig(UUID townId) {
        return townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, OPERATIONAL_KEY)
                .map(this::toOperational)
                .orElse(TownOperationalConfigResponse.builder().minOrderValue(DEFAULT_MIN_ORDER).build());
    }

    private TownOperationalConfigResponse toOperational(TownConfig config) {
        Map<String, Object> value = config.getConfigValue();
        Object minOrder = value != null ? value.get("minOrderValue") : null;
        BigDecimal minOrderValue = minOrder instanceof Number number
                ? BigDecimal.valueOf(number.doubleValue())
                : DEFAULT_MIN_ORDER;
        return TownOperationalConfigResponse.builder().minOrderValue(minOrderValue).build();
    }
}
