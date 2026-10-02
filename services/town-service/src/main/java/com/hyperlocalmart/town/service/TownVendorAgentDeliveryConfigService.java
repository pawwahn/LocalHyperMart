package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.response.TownVendorAgentDeliveryConfigResponse;
import com.hyperlocalmart.town.entity.TownConfig;
import com.hyperlocalmart.town.repository.TownConfigRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TownVendorAgentDeliveryConfigService {

    static final String CONFIG_KEY = "vendorAgentDelivery";

    private final TownConfigRepository townConfigRepository;
    private final TownRepository townRepository;
    private final AdminAuditor adminAuditService;

    @Transactional
    public void ensureDefault(UUID townId) {
        boolean exists = townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, CONFIG_KEY)
                .isPresent();
        if (exists) {
            return;
        }
        Instant now = Instant.now();
        TownConfig config = TownConfig.builder()
                .townId(townId)
                .configKey(CONFIG_KEY)
                .configValue(toMap(defaultConfig()))
                .effectiveFrom(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        townConfigRepository.save(config);
    }

    @Transactional(readOnly = true)
    public TownVendorAgentDeliveryConfigResponse get(UUID townId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        ensureDefault(townId);
        return townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, CONFIG_KEY)
                .map(row -> fromMap(row.getConfigValue()))
                .orElseGet(this::defaultConfig);
    }

    @Transactional
    public TownVendorAgentDeliveryConfigResponse replace(UUID townId, TownVendorAgentDeliveryConfigResponse request, UUID actorId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        ensureDefault(townId);
        TownVendorAgentDeliveryConfigResponse before = get(townId);
        TownVendorAgentDeliveryConfigResponse normalized = normalize(request);
        save(townId, normalized);
        adminAuditService.record(
                "town-vendor-agent-delivery",
                "UPDATE",
                "Updated vendor-agent delivery settings",
                actorId,
                "SUPER_ADMIN",
                townId,
                "VENDOR_AGENT_DELIVERY",
                townId,
                before,
                normalized);
        return get(townId);
    }

    private void save(UUID townId, TownVendorAgentDeliveryConfigResponse cfg) {
        Instant now = Instant.now();
        townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, CONFIG_KEY)
                .ifPresent(row -> {
                    row.setEffectiveTo(now);
                    row.setUpdatedAt(now);
                    townConfigRepository.save(row);
                });
        TownConfig next = TownConfig.builder()
                .townId(townId)
                .configKey(CONFIG_KEY)
                .configValue(toMap(cfg))
                .effectiveFrom(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        townConfigRepository.save(next);
    }

    private TownVendorAgentDeliveryConfigResponse normalize(TownVendorAgentDeliveryConfigResponse req) {
        if (req == null) {
            return defaultConfig();
        }
        return TownVendorAgentDeliveryConfigResponse.builder()
                .enabled(req.isEnabled())
                .vendorAgentPayoutAmount(nonNegative(req.getVendorAgentPayoutAmount()))
                .hubPayoutAmount(nonNegative(req.getHubPayoutAmount()))
                .build();
    }

    private static BigDecimal nonNegative(BigDecimal v) {
        if (v == null) {
            return BigDecimal.ZERO;
        }
        return v.max(BigDecimal.ZERO);
    }

    private TownVendorAgentDeliveryConfigResponse defaultConfig() {
        return TownVendorAgentDeliveryConfigResponse.builder()
                .enabled(false)
                .vendorAgentPayoutAmount(BigDecimal.ZERO)
                .hubPayoutAmount(BigDecimal.ZERO)
                .build();
    }

    @SuppressWarnings("unchecked")
    private TownVendorAgentDeliveryConfigResponse fromMap(Map<String, Object> map) {
        if (map == null || map.isEmpty()) {
            return defaultConfig();
        }
        return TownVendorAgentDeliveryConfigResponse.builder()
                .enabled(Boolean.TRUE.equals(map.get("enabled")))
                .vendorAgentPayoutAmount(decimal(map.get("vendorAgentPayoutAmount")))
                .hubPayoutAmount(decimal(map.get("hubPayoutAmount")))
                .build();
    }

    private Map<String, Object> toMap(TownVendorAgentDeliveryConfigResponse cfg) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("enabled", cfg.isEnabled());
        map.put("vendorAgentPayoutAmount", cfg.getVendorAgentPayoutAmount());
        map.put("hubPayoutAmount", cfg.getHubPayoutAmount());
        return map;
    }

    private static BigDecimal decimal(Object raw) {
        if (raw == null) {
            return BigDecimal.ZERO;
        }
        if (raw instanceof BigDecimal bd) {
            return bd.max(BigDecimal.ZERO);
        }
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).max(BigDecimal.ZERO);
        }
        try {
            return new BigDecimal(String.valueOf(raw)).max(BigDecimal.ZERO);
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO;
        }
    }
}
