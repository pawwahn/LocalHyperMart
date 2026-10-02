package com.hyperlocalmart.town.service;

import com.hyperlocalmart.town.dto.response.TownVendorAgentDeliveryConfigResponse;
import com.hyperlocalmart.town.entity.TownConfig;
import com.hyperlocalmart.town.repository.TownConfigRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TownVendorAgentDeliveryConfigServiceTest {

    @Mock private TownConfigRepository townConfigRepository;
    @Mock private TownRepository townRepository;
    @Mock private AdminAuditor adminAuditService;

    @InjectMocks private TownVendorAgentDeliveryConfigService service;

    private final UUID townId = UUID.fromString("a8e7366c-2bd8-4376-b18b-7ba110f4d69f");
    private TownConfig stored;

    @BeforeEach
    void setUp() {
        stored = TownConfig.builder()
                .id(UUID.randomUUID())
                .townId(townId)
                .configKey(TownVendorAgentDeliveryConfigService.CONFIG_KEY)
                .configValue(Map.of("enabled", false, "vendorAgentPayoutAmount", 0, "hubPayoutAmount", 0))
                .effectiveFrom(Instant.now())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void replace_persistsEnabledAndAmounts() {
        UUID actorId = UUID.randomUUID();
        when(townRepository.existsById(townId)).thenReturn(true);
        when(townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(
                        eq(townId), eq(TownVendorAgentDeliveryConfigService.CONFIG_KEY)))
                .thenReturn(Optional.of(stored));

        TownVendorAgentDeliveryConfigResponse request = TownVendorAgentDeliveryConfigResponse.builder()
                .enabled(true)
                .vendorAgentPayoutAmount(new BigDecimal("45.00"))
                .hubPayoutAmount(new BigDecimal("12.50"))
                .build();

        service.replace(townId, request, actorId);

        ArgumentCaptor<TownConfig> captor = ArgumentCaptor.forClass(TownConfig.class);
        verify(townConfigRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        TownConfig next = captor.getAllValues().stream()
                .filter(row -> row.getConfigValue().containsKey("vendorAgentPayoutAmount"))
                .reduce((a, b) -> b)
                .orElseThrow();
        assertThat(next.getConfigValue().get("enabled")).isEqualTo(true);
        assertThat(next.getConfigValue().get("vendorAgentPayoutAmount")).isEqualTo(new BigDecimal("45.00"));
    }
}
