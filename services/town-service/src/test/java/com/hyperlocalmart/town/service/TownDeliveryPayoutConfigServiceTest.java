package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.town.dto.request.UpdateTownAgentPayoutRatesRequest;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.PayoutPartyConfig;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.PerOrderIncentive;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.PeriodIncentive;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.VolumeSlabIncentive;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.VolumeSlabTier;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TownDeliveryPayoutConfigServiceTest {

    @Mock private TownConfigRepository townConfigRepository;
    @Mock private TownRepository townRepository;
    @Mock private AdminAuditor adminAuditService;
    @InjectMocks private TownDeliveryPayoutConfigService service;

    private final UUID townId = UUID.fromString("a8e7366c-2bd8-4376-b18b-7ba110f4d69f");
    private TownConfig stored;

    @BeforeEach
    void setUp() {
        stored = TownConfig.builder()
                .id(UUID.randomUUID())
                .townId(townId)
                .configKey(TownDeliveryPayoutConfigService.CONFIG_KEY)
                .configValue(Map.of())
                .effectiveFrom(Instant.now())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void get_returnsZerosWhenMissing() {
        when(townRepository.existsById(townId)).thenReturn(true);
        when(townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(
                        townId, TownDeliveryPayoutConfigService.CONFIG_KEY))
                .thenReturn(Optional.empty());

        TownDeliveryPayoutConfigResponse cfg = service.get(townId);

        assertThat(cfg.isTownAdminCanEditAgentRates()).isFalse();
        assertThat(cfg.getAgent().getPerOrder().getPickupAmount()).isEqualByComparingTo("0.00");
        assertThat(cfg.getHub().isEnabled()).isTrue();
    }

    @Test
    void replace_persistsAgentAndHubModels() {
        when(townRepository.existsById(townId)).thenReturn(true);
        when(townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(
                        eq(townId), eq(TownDeliveryPayoutConfigService.CONFIG_KEY)))
                .thenReturn(Optional.of(stored));
        stored.setConfigValue(seedValue());

        TownDeliveryPayoutConfigResponse req = service.get(townId);
        req.setTownAdminCanEditAgentRates(true);
        req.getAgent().getPerOrder().setPickupAmount(new BigDecimal("10"));
        req.getAgent().getPerOrder().setLastMileAmount(new BigDecimal("25"));
        req.getHub().getPerOrder().setPickupAmount(new BigDecimal("5"));
        req.getHub().getPerMonth().setEnabled(true);
        req.getHub().getPerMonth().setAmount(new BigDecimal("3000"));

        service.replace(townId, req);

        ArgumentCaptor<TownConfig> captor = ArgumentCaptor.forClass(TownConfig.class);
        verify(townConfigRepository).save(captor.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> agent = (Map<String, Object>) captor.getValue().getConfigValue().get("agent");
        @SuppressWarnings("unchecked")
        Map<String, Object> perOrder = (Map<String, Object>) agent.get("perOrder");
        assertThat(perOrder.get("lastMileAmount")).isEqualTo(new BigDecimal("25.00"));
        assertThat(captor.getValue().getConfigValue().get("townAdminCanEditAgentRates")).isEqualTo(true);
    }

    @Test
    void updateAgentRates_forbiddenWhenSwitchOff() {
        UpdateTownAgentPayoutRatesRequest request = new UpdateTownAgentPayoutRatesRequest();
        assertThatThrownBy(() -> service.updateAgentRates(townId, request, false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void updateAgentRates_changesAgentAmountsOnly() {
        when(townRepository.existsById(townId)).thenReturn(true);
        stored.setConfigValue(seedValue());
        when(townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(
                        eq(townId), eq(TownDeliveryPayoutConfigService.CONFIG_KEY)))
                .thenReturn(Optional.of(stored));

        UpdateTownAgentPayoutRatesRequest request = new UpdateTownAgentPayoutRatesRequest();
        UpdateTownAgentPayoutRatesRequest.PerOrderRates rates = new UpdateTownAgentPayoutRatesRequest.PerOrderRates();
        rates.setPickupAmount(new BigDecimal("12"));
        rates.setLastMileAmount(new BigDecimal("30"));
        request.setPerOrder(rates);

        service.updateAgentRates(townId, request, true);

        ArgumentCaptor<TownConfig> captor = ArgumentCaptor.forClass(TownConfig.class);
        verify(townConfigRepository).save(captor.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> hub = (Map<String, Object>) captor.getValue().getConfigValue().get("hub");
        @SuppressWarnings("unchecked")
        Map<String, Object> hubPerOrder = (Map<String, Object>) hub.get("perOrder");
        assertThat(hubPerOrder.get("pickupAmount")).isEqualTo(new BigDecimal("4.00"));
        @SuppressWarnings("unchecked")
        Map<String, Object> agent = (Map<String, Object>) captor.getValue().getConfigValue().get("agent");
        @SuppressWarnings("unchecked")
        Map<String, Object> agentPerOrder = (Map<String, Object>) agent.get("perOrder");
        assertThat(agentPerOrder.get("pickupAmount")).isEqualTo(new BigDecimal("12.00"));
        assertThat(captor.getValue().getConfigValue().get("townAdminCanEditAgentRates")).isEqualTo(false);
    }

    @Test
    void estimate_addsPerOrderDayMonthAndMatchingSlab() {
        TownDeliveryPayoutConfigResponse cfg = emptyEnabled();
        cfg.getAgent().getPerOrder().setPickupAmount(new BigDecimal("10"));
        cfg.getAgent().getPerOrder().setLastMileAmount(new BigDecimal("20"));
        cfg.getAgent().getPerOrder().setCompletedOrderAmount(new BigDecimal("5"));
        cfg.getAgent().getPerDay().setEnabled(true);
        cfg.getAgent().getPerDay().setAmount(new BigDecimal("50"));
        cfg.getAgent().getPerMonth().setEnabled(true);
        cfg.getAgent().getPerMonth().setAmount(new BigDecimal("500"));
        cfg.getAgent().getPerMonth().setMinCompletedOrders(10);
        cfg.getAgent().getSlabs().setEnabled(true);
        cfg.getAgent().getSlabs().setPayout("FLAT_BONUS");
        cfg.getAgent().getSlabs().setTiers(List.of(
                VolumeSlabTier.builder().minCount(1).maxCount(20).amount(new BigDecimal("100")).build(),
                VolumeSlabTier.builder().minCount(21).maxCount(null).amount(new BigDecimal("250")).build()));
        cfg.getHub().getPerOrder().setCompletedOrderAmount(new BigDecimal("8"));

        TownDeliveryPayoutConfigService.PayoutEstimate estimate = service.estimate(cfg, 25, 25, 25, 4);
        assertThat(estimate.agentTotal()).isEqualByComparingTo("875.00");
        assertThat(estimate.hubTotal()).isEqualByComparingTo("200.00");
    }

    @Test
    void estimate_perUnitSlabUsesCountTimesRate() {
        TownDeliveryPayoutConfigResponse cfg = emptyEnabled();
        cfg.getAgent().getPerOrder().setEnabled(false);
        cfg.getAgent().getSlabs().setEnabled(true);
        cfg.getAgent().getSlabs().setPayout("PER_UNIT");
        cfg.getAgent().getSlabs().setMetric("LAST_MILE");
        cfg.getAgent().getSlabs().setTiers(List.of(
                VolumeSlabTier.builder().minCount(1).maxCount(null).amount(new BigDecimal("15")).build()));
        cfg.getHub().setEnabled(false);

        assertThat(service.estimate(cfg, 3, 2, 4, 0).agentTotal()).isEqualByComparingTo("0.00");
    }

    @Test
    void normalize_rejectsOverlappingSlabs() {
        when(townRepository.existsById(townId)).thenReturn(true);
        when(townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(
                        eq(townId), eq(TownDeliveryPayoutConfigService.CONFIG_KEY)))
                .thenReturn(Optional.of(stored));
        stored.setConfigValue(seedValue());

        TownDeliveryPayoutConfigResponse req = service.get(townId);
        req.getAgent().getSlabs().setEnabled(true);
        req.getAgent().getSlabs().setTiers(List.of(
                VolumeSlabTier.builder().minCount(1).maxCount(50).amount(BigDecimal.ONE).build(),
                VolumeSlabTier.builder().minCount(40).maxCount(null).amount(BigDecimal.TEN).build()));

        assertThatThrownBy(() -> service.replace(townId, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("overlap");
    }

    private TownDeliveryPayoutConfigResponse emptyEnabled() {
        return TownDeliveryPayoutConfigResponse.builder()
                .townAdminCanEditAgentRates(false)
                .agent(PayoutPartyConfig.builder()
                        .enabled(true)
                        .perOrder(PerOrderIncentive.builder().enabled(true)
                                .pickupAmount(BigDecimal.ZERO)
                                .lastMileAmount(BigDecimal.ZERO)
                                .completedOrderAmount(BigDecimal.ZERO)
                                .build())
                        .perDay(PeriodIncentive.builder().enabled(false).amount(BigDecimal.ZERO).build())
                        .perMonth(PeriodIncentive.builder().enabled(false).amount(BigDecimal.ZERO).build())
                        .slabs(VolumeSlabIncentive.builder().enabled(false).period("MONTH")
                                .metric("COMPLETED_ORDERS").payout("PER_UNIT")
                                .tiers(List.of()).build())
                        .build())
                .hub(PayoutPartyConfig.builder()
                        .enabled(true)
                        .perOrder(PerOrderIncentive.builder().enabled(true)
                                .pickupAmount(BigDecimal.ZERO)
                                .lastMileAmount(BigDecimal.ZERO)
                                .completedOrderAmount(BigDecimal.ZERO)
                                .build())
                        .perDay(PeriodIncentive.builder().enabled(false).amount(BigDecimal.ZERO).build())
                        .perMonth(PeriodIncentive.builder().enabled(false).amount(BigDecimal.ZERO).build())
                        .slabs(VolumeSlabIncentive.builder().enabled(false).period("MONTH")
                                .metric("COMPLETED_ORDERS").payout("PER_UNIT")
                                .tiers(List.of()).build())
                        .build())
                .build();
    }

    private Map<String, Object> seedValue() {
        Map<String, Object> openTier = new java.util.LinkedHashMap<>();
        openTier.put("minCount", 1);
        openTier.put("maxCount", null);
        openTier.put("amount", 0);
        Map<String, Object> slabs = new java.util.LinkedHashMap<>();
        slabs.put("enabled", false);
        slabs.put("period", "MONTH");
        slabs.put("metric", "COMPLETED_ORDERS");
        slabs.put("payout", "PER_UNIT");
        slabs.put("tiers", List.of(openTier));
        Map<String, Object> agent = new java.util.LinkedHashMap<>();
        agent.put("enabled", true);
        agent.put("perOrder", Map.of(
                "enabled", true,
                "pickupAmount", 8,
                "lastMileAmount", 18,
                "completedOrderAmount", 0));
        agent.put("perDay", Map.of("enabled", false, "amount", 0, "minCompletedOrders", 0));
        agent.put("perMonth", Map.of("enabled", false, "amount", 0, "minCompletedOrders", 0));
        agent.put("slabs", slabs);
        Map<String, Object> hub = new java.util.LinkedHashMap<>();
        hub.put("enabled", true);
        hub.put("perOrder", Map.of(
                "enabled", true,
                "pickupAmount", 4,
                "lastMileAmount", 6,
                "completedOrderAmount", 0));
        hub.put("perDay", Map.of("enabled", false, "amount", 0, "minCompletedOrders", 0));
        hub.put("perMonth", Map.of("enabled", false, "amount", 0, "minCompletedOrders", 0));
        hub.put("slabs", slabs);
        Map<String, Object> value = new java.util.LinkedHashMap<>();
        value.put("townAdminCanEditAgentRates", false);
        value.put("agent", agent);
        value.put("hub", hub);
        return value;
    }
}
