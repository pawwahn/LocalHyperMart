package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.request.UpdateTownAgentPayoutRatesRequest;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.PayoutPartyConfig;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.PerOrderIncentive;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.PeriodIncentive;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.VolumeSlabIncentive;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.VolumeSlabTier;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse.FranchiseTerms;
import com.hyperlocalmart.town.entity.TownConfig;
import com.hyperlocalmart.town.repository.TownConfigRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TownDeliveryPayoutConfigService {

    static final String CONFIG_KEY = "deliveryPayout";
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String PERIOD_DAY = "DAY";
    private static final String PERIOD_MONTH = "MONTH";
    private static final String METRIC_ORDERS = "COMPLETED_ORDERS";
    private static final String METRIC_LAST_MILE = "LAST_MILE";
    private static final String METRIC_ALL_TRIPS = "ALL_TRIPS";
    private static final String PAYOUT_PER_UNIT = "PER_UNIT";
    private static final String PAYOUT_FLAT = "FLAT_BONUS";

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

    @Transactional
    public TownDeliveryPayoutConfigResponse get(UUID townId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        ensureDefault(townId);
        TownDeliveryPayoutConfigResponse cfg = townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, CONFIG_KEY)
                .map(row -> fromMap(row.getConfigValue()))
                .orElseGet(this::defaultConfig);
        fillMissingHubFranchiseBillingStart(cfg);
        return cfg;
    }

    @Transactional
    public TownDeliveryPayoutConfigResponse replace(UUID townId, TownDeliveryPayoutConfigResponse request) {
        return replace(townId, request, null);
    }

    @Transactional
    public TownDeliveryPayoutConfigResponse replace(
            UUID townId, TownDeliveryPayoutConfigResponse request, UUID actorId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        ensureDefault(townId);
        TownDeliveryPayoutConfigResponse before = get(townId);
        TownDeliveryPayoutConfigResponse normalized = normalizeFull(request);
        mergeFranchiseEffectiveFrom(before.getHub(), normalized.getHub());
        save(townId, normalized);
        adminAuditService.record(
                "town-incentives",
                "UPDATE_HUB_AGENT_PAY",
                "Updated hub and agent pay rules",
                actorId,
                "SUPER_ADMIN",
                townId,
                "DELIVERY_PAYOUT",
                townId,
                before,
                normalized);
        return get(townId);
    }

    @Transactional
    public TownDeliveryPayoutConfigResponse updateAgentRates(
            UUID townId, UpdateTownAgentPayoutRatesRequest request, boolean allowed) {
        return updateAgentRates(townId, request, allowed, null);
    }

    @Transactional
    public TownDeliveryPayoutConfigResponse updateAgentRates(
            UUID townId, UpdateTownAgentPayoutRatesRequest request, boolean allowed, UUID actorId) {
        if (!allowed) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN, "Super admin has not allowed town admin to edit agent rates");
        }
        TownDeliveryPayoutConfigResponse current = get(townId);
        TownDeliveryPayoutConfigResponse before = fromMap(toMap(current));
        ensureDefault(townId);
        PayoutPartyConfig agent = current.getAgent();
        if (request.getPerOrder() != null) {
            PerOrderIncentive perOrder = agent.getPerOrder();
            if (request.getPerOrder().getPickupAmount() != null) {
                perOrder.setPickupAmount(money(request.getPerOrder().getPickupAmount(), "Agent pickup ₹"));
            }
            if (request.getPerOrder().getLastMileAmount() != null) {
                perOrder.setLastMileAmount(money(request.getPerOrder().getLastMileAmount(), "Agent last-mile ₹"));
            }
            if (request.getPerOrder().getCompletedOrderAmount() != null) {
                perOrder.setCompletedOrderAmount(
                        money(request.getPerOrder().getCompletedOrderAmount(), "Agent per-order ₹"));
            }
        }
        if (request.getPerDay() != null) {
            applyPeriodRates(agent.getPerDay(), request.getPerDay(), "Agent daily ₹");
        }
        if (request.getPerMonth() != null) {
            applyPeriodRates(agent.getPerMonth(), request.getPerMonth(), "Agent monthly ₹");
        }
        if (request.getSlabAmounts() != null && !request.getSlabAmounts().isEmpty()) {
            List<VolumeSlabTier> tiers = agent.getSlabs().getTiers();
            if (request.getSlabAmounts().size() != tiers.size()) {
                throw new BusinessException(
                        ErrorCode.VALIDATION_ERROR, "Send one amount for each existing agent slab row");
            }
            for (int i = 0; i < tiers.size(); i++) {
                tiers.get(i).setAmount(money(request.getSlabAmounts().get(i), "Agent slab ₹"));
            }
        }
        save(townId, current);
        adminAuditService.record(
                "town-incentives",
                "UPDATE_AGENT_RATES",
                "Updated agent rates",
                actorId,
                actorId == null ? "HUB_ADMIN" : "SUPER_ADMIN",
                townId,
                "DELIVERY_PAYOUT",
                townId,
                before,
                current);
        return get(townId);
    }

    /**
     * What Payouts will pay for N delivered orders (per-order ₹ only).
     * Franchise rent is collected separately and is not included.
     */
    public PayoutEstimate estimate(
            TownDeliveryPayoutConfigResponse config,
            int completedOrders,
            int pickups,
            int lastMiles,
            int qualifyingDays) {
        BigDecimal agent = partyTotal(config.getAgent(), completedOrders, pickups, lastMiles, qualifyingDays);
        BigDecimal hub = partyTotal(config.getHub(), completedOrders, pickups, lastMiles, qualifyingDays);
        return new PayoutEstimate(agent, hub);
    }

    public record PayoutEstimate(BigDecimal agentTotal, BigDecimal hubTotal) {
    }

    private BigDecimal partyTotal(
            PayoutPartyConfig party, int orders, int pickups, int lastMiles, int qualifyingDays) {
        if (party == null || !party.isEnabled()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal total = BigDecimal.ZERO;
        PerOrderIncentive perOrder = party.getPerOrder();
        if (perOrder != null && perOrder.isEnabled()) {
            total = total.add(moneyOrZero(perOrder.getPickupAmount()).multiply(BigDecimal.valueOf(Math.max(0, pickups))));
            total = total.add(moneyOrZero(perOrder.getLastMileAmount()).multiply(BigDecimal.valueOf(Math.max(0, lastMiles))));
            total = total.add(moneyOrZero(perOrder.getCompletedOrderAmount())
                    .multiply(BigDecimal.valueOf(Math.max(0, orders))));
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    private static VolumeSlabTier matchTier(List<VolumeSlabTier> tiers, int count) {
        if (tiers == null) {
            return null;
        }
        for (VolumeSlabTier tier : tiers) {
            int min = Math.max(0, tier.getMinCount());
            Integer max = tier.getMaxCount();
            if (count >= min && (max == null || count <= max)) {
                return tier;
            }
        }
        return null;
    }

    private void save(UUID townId, TownDeliveryPayoutConfigResponse value) {
        TownConfig config = townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, CONFIG_KEY)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Town payout config not found"));
        config.setConfigValue(toMap(value));
        config.setUpdatedAt(Instant.now());
        townConfigRepository.save(config);
    }

    private TownDeliveryPayoutConfigResponse defaultConfig() {
        return TownDeliveryPayoutConfigResponse.builder()
                .townAdminCanEditAgentRates(false)
                .agent(defaultParty())
                .hub(defaultParty())
                .build();
    }

    private PayoutPartyConfig defaultParty() {
        return PayoutPartyConfig.builder()
                .enabled(true)
                .perOrder(PerOrderIncentive.builder()
                        .enabled(true)
                        .pickupAmount(BigDecimal.ZERO)
                        .lastMileAmount(BigDecimal.ZERO)
                        .completedOrderAmount(BigDecimal.ZERO)
                        .build())
                .perDay(PeriodIncentive.builder().enabled(false).amount(BigDecimal.ZERO).minCompletedOrders(0).build())
                .perMonth(PeriodIncentive.builder().enabled(false).amount(BigDecimal.ZERO).minCompletedOrders(0).build())
                .slabs(VolumeSlabIncentive.builder()
                        .enabled(false)
                        .period(PERIOD_MONTH)
                        .metric(METRIC_ORDERS)
                        .payout(PAYOUT_PER_UNIT)
                        .tiers(List.of(VolumeSlabTier.builder()
                                .minCount(1)
                                .maxCount(null)
                                .amount(BigDecimal.ZERO)
                                .build()))
                        .build())
                .franchise(FranchiseTerms.builder()
                        .enabled(false)
                        .cadence("MONTHLY")
                        .amount(BigDecimal.ZERO)
                        .build())
                .build();
    }

    private TownDeliveryPayoutConfigResponse normalizeFull(TownDeliveryPayoutConfigResponse request) {
        if (request == null) {
            return defaultConfig();
        }
        TownDeliveryPayoutConfigResponse out = defaultConfig();
        out.setTownAdminCanEditAgentRates(request.isTownAdminCanEditAgentRates());
        out.setAgent(normalizeParty(request.getAgent(), "Agent"));
        out.setHub(normalizeParty(request.getHub(), "Hub"));
        return out;
    }

    private PayoutPartyConfig normalizeParty(PayoutPartyConfig in, String label) {
        PayoutPartyConfig base = defaultParty();
        if (in == null) {
            return base;
        }
        base.setEnabled(in.isEnabled());
        if (in.getPerOrder() != null) {
            PerOrderIncentive p = in.getPerOrder();
            base.setPerOrder(PerOrderIncentive.builder()
                    .enabled(p.isEnabled())
                    .pickupAmount(money(p.getPickupAmount(), label + " pickup ₹"))
                    .lastMileAmount(money(p.getLastMileAmount(), label + " last-mile ₹"))
                    .completedOrderAmount(money(p.getCompletedOrderAmount(), label + " per-order ₹"))
                    .build());
        }
        if (in.getPerDay() != null) {
            base.setPerDay(normalizePeriod(in.getPerDay(), label + " daily"));
        }
        if (in.getPerMonth() != null) {
            base.setPerMonth(normalizePeriod(in.getPerMonth(), label + " monthly"));
        }
        if (in.getSlabs() != null) {
            base.setSlabs(normalizeSlabs(in.getSlabs(), label));
        }
        if ("Hub".equals(label) && in.getFranchise() != null) {
            base.setFranchise(normalizeFranchise(in.getFranchise()));
        } else {
            base.setFranchise(FranchiseTerms.builder().enabled(false).cadence("MONTHLY").amount(BigDecimal.ZERO).build());
        }
        return base;
    }

    private FranchiseTerms normalizeFranchise(FranchiseTerms in) {
        String cadence = in.getCadence() == null ? "MONTHLY" : in.getCadence().trim().toUpperCase();
        if (!List.of("MONTHLY", "QUARTERLY", "YEARLY", "LIFETIME").contains(cadence)) {
            cadence = "MONTHLY";
        }
        String effectiveFrom = normalizeFranchiseEffectiveFrom(in.getEffectiveFrom());
        return FranchiseTerms.builder()
                .enabled(in.isEnabled())
                .cadence(cadence)
                .amount(money(in.getAmount(), "Hub franchise ₹"))
                .effectiveFrom(effectiveFrom)
                .build();
    }

    private void mergeFranchiseEffectiveFrom(PayoutPartyConfig before, PayoutPartyConfig after) {
        if (after == null || after.getFranchise() == null || !after.getFranchise().isEnabled()) {
            return;
        }
        FranchiseTerms fr = after.getFranchise();
        if (fr.getEffectiveFrom() != null && !fr.getEffectiveFrom().isBlank()) {
            return;
        }
        FranchiseTerms prev = before != null ? before.getFranchise() : null;
        if (prev != null && prev.isEnabled() && prev.getEffectiveFrom() != null && !prev.getEffectiveFrom().isBlank()) {
            fr.setEffectiveFrom(prev.getEffectiveFrom());
            return;
        }
        fr.setEffectiveFrom(defaultFranchiseEffectiveFrom());
    }

    /** Hub franchise can be enabled in DB without billing start; APIs still need a month for payment-service. */
    private void fillMissingHubFranchiseBillingStart(TownDeliveryPayoutConfigResponse cfg) {
        if (cfg == null || cfg.getHub() == null) {
            return;
        }
        FranchiseTerms fr = cfg.getHub().getFranchise();
        if (fr == null || !fr.isEnabled()) {
            return;
        }
        if (fr.getEffectiveFrom() != null && !fr.getEffectiveFrom().isBlank()) {
            return;
        }
        fr.setEffectiveFrom(defaultFranchiseEffectiveFrom());
    }

    private static String defaultFranchiseEffectiveFrom() {
        LocalDate firstOfMonth = LocalDate.now(IST).withDayOfMonth(1);
        return firstOfMonth.toString();
    }

    private static String normalizeFranchiseEffectiveFrom(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.length() == 7) {
            return trimmed + "-01";
        }
        try {
            return LocalDate.parse(trimmed).withDayOfMonth(1).toString();
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Franchise billing start must be YYYY-MM-DD");
        }
    }

    private PeriodIncentive normalizePeriod(PeriodIncentive in, String label) {
        return PeriodIncentive.builder()
                .enabled(in.isEnabled())
                .amount(money(in.getAmount(), label + " ₹"))
                .minCompletedOrders(Math.max(0, in.getMinCompletedOrders()))
                .build();
    }

    private VolumeSlabIncentive normalizeSlabs(VolumeSlabIncentive in, String label) {
        String period = normalizePeriodName(in.getPeriod());
        String metric = normalizeMetric(in.getMetric());
        String payout = normalizePayout(in.getPayout());
        List<VolumeSlabTier> input = in.getTiers() == null || in.getTiers().isEmpty()
                ? List.of(VolumeSlabTier.builder().minCount(1).maxCount(null).amount(BigDecimal.ZERO).build())
                : in.getTiers();
        List<VolumeSlabTier> sorted = new ArrayList<>(input);
        sorted.sort(Comparator.comparingInt(t -> Math.max(0, t.getMinCount())));
        List<VolumeSlabTier> out = new ArrayList<>();
        Integer prevMax = null;
        for (int i = 0; i < sorted.size(); i++) {
            VolumeSlabTier row = sorted.get(i);
            int min = Math.max(0, row.getMinCount());
            Integer max = row.getMaxCount();
            if (max != null && max < min) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " slab max must be ≥ min");
            }
            if (prevMax != null && min <= prevMax) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " volume slabs overlap");
            }
            out.add(VolumeSlabTier.builder()
                    .minCount(min)
                    .maxCount(max)
                    .amount(money(row.getAmount(), label + " slab ₹"))
                    .build());
            prevMax = max;
            if (i == sorted.size() - 1 && max == null) {
                prevMax = Integer.MAX_VALUE;
            }
        }
        return VolumeSlabIncentive.builder()
                .enabled(in.isEnabled())
                .period(period)
                .metric(metric)
                .payout(payout)
                .tiers(out)
                .build();
    }

    private void applyPeriodRates(
            PeriodIncentive target, UpdateTownAgentPayoutRatesRequest.PeriodRates incoming, String label) {
        if (incoming.getAmount() != null) {
            target.setAmount(money(incoming.getAmount(), label));
        }
        if (incoming.getMinCompletedOrders() != null) {
            target.setMinCompletedOrders(Math.max(0, incoming.getMinCompletedOrders()));
        }
    }

    private Map<String, Object> toMap(TownDeliveryPayoutConfigResponse cfg) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("townAdminCanEditAgentRates", cfg.isTownAdminCanEditAgentRates());
        value.put("agent", partyMap(cfg.getAgent()));
        value.put("hub", partyMap(cfg.getHub()));
        return value;
    }

    private Map<String, Object> partyMap(PayoutPartyConfig party) {
        PayoutPartyConfig p = party == null ? defaultParty() : party;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("enabled", p.isEnabled());
        map.put("perOrder", Map.of(
                "enabled", p.getPerOrder().isEnabled(),
                "pickupAmount", p.getPerOrder().getPickupAmount(),
                "lastMileAmount", p.getPerOrder().getLastMileAmount(),
                "completedOrderAmount", p.getPerOrder().getCompletedOrderAmount()));
        map.put("perDay", Map.of(
                "enabled", p.getPerDay().isEnabled(),
                "amount", p.getPerDay().getAmount(),
                "minCompletedOrders", p.getPerDay().getMinCompletedOrders()));
        map.put("perMonth", Map.of(
                "enabled", p.getPerMonth().isEnabled(),
                "amount", p.getPerMonth().getAmount(),
                "minCompletedOrders", p.getPerMonth().getMinCompletedOrders()));
        Map<String, Object> slabs = new LinkedHashMap<>();
        slabs.put("enabled", p.getSlabs().isEnabled());
        slabs.put("period", p.getSlabs().getPeriod());
        slabs.put("metric", p.getSlabs().getMetric());
        slabs.put("payout", p.getSlabs().getPayout());
        List<Map<String, Object>> tiers = new ArrayList<>();
        for (VolumeSlabTier t : p.getSlabs().getTiers()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("minCount", t.getMinCount());
            row.put("maxCount", t.getMaxCount());
            row.put("amount", t.getAmount());
            tiers.add(row);
        }
        slabs.put("tiers", tiers);
        map.put("slabs", slabs);
        FranchiseTerms f = p.getFranchise() == null ? defaultParty().getFranchise() : p.getFranchise();
        Map<String, Object> franchise = new LinkedHashMap<>();
        franchise.put("enabled", f.isEnabled());
        franchise.put("cadence", f.getCadence() == null ? "MONTHLY" : f.getCadence());
        franchise.put("amount", f.getAmount() == null ? BigDecimal.ZERO : f.getAmount());
        if (f.getEffectiveFrom() != null && !f.getEffectiveFrom().isBlank()) {
            franchise.put("effectiveFrom", f.getEffectiveFrom());
        }
        map.put("franchise", franchise);
        return map;
    }

    @SuppressWarnings("unchecked")
    private TownDeliveryPayoutConfigResponse fromMap(Map<String, Object> value) {
        TownDeliveryPayoutConfigResponse cfg = defaultConfig();
        if (value == null) {
            return cfg;
        }
        cfg.setTownAdminCanEditAgentRates(asBool(value.get("townAdminCanEditAgentRates"), false));
        if (value.get("agent") instanceof Map<?, ?> agent) {
            cfg.setAgent(partyFrom((Map<String, Object>) agent));
        }
        if (value.get("hub") instanceof Map<?, ?> hub) {
            cfg.setHub(partyFrom((Map<String, Object>) hub));
        }
        return cfg;
    }

    @SuppressWarnings("unchecked")
    private PayoutPartyConfig partyFrom(Map<String, Object> map) {
        PayoutPartyConfig party = defaultParty();
        party.setEnabled(asBool(map.get("enabled"), true));
        if (map.get("perOrder") instanceof Map<?, ?> perOrderRaw) {
            Map<String, Object> perOrder = (Map<String, Object>) perOrderRaw;
            party.setPerOrder(PerOrderIncentive.builder()
                    .enabled(asBool(perOrder.get("enabled"), true))
                    .pickupAmount(asMoney(perOrder.get("pickupAmount")))
                    .lastMileAmount(asMoney(perOrder.get("lastMileAmount")))
                    .completedOrderAmount(asMoney(perOrder.get("completedOrderAmount")))
                    .build());
        }
        if (map.get("perDay") instanceof Map<?, ?> perDayRaw) {
            party.setPerDay(periodFrom((Map<String, Object>) perDayRaw));
        }
        if (map.get("perMonth") instanceof Map<?, ?> perMonthRaw) {
            party.setPerMonth(periodFrom((Map<String, Object>) perMonthRaw));
        }
        if (map.get("slabs") instanceof Map<?, ?> slabsRaw) {
            Map<String, Object> slabs = (Map<String, Object>) slabsRaw;
            List<VolumeSlabTier> tiers = new ArrayList<>();
            if (slabs.get("tiers") instanceof List<?> rawTiers) {
                for (Object item : rawTiers) {
                    if (!(item instanceof Map<?, ?> row)) {
                        continue;
                    }
                    tiers.add(VolumeSlabTier.builder()
                            .minCount(asInt(row.get("minCount"), 1))
                            .maxCount(row.get("maxCount") == null ? null : asInt(row.get("maxCount"), 0))
                            .amount(asMoney(row.get("amount")))
                            .build());
                }
            }
            if (tiers.isEmpty()) {
                tiers.add(VolumeSlabTier.builder().minCount(1).maxCount(null).amount(BigDecimal.ZERO).build());
            }
            party.setSlabs(VolumeSlabIncentive.builder()
                    .enabled(asBool(slabs.get("enabled"), false))
                    .period(normalizePeriodName(String.valueOf(slabs.getOrDefault("period", PERIOD_MONTH))))
                    .metric(normalizeMetric(String.valueOf(slabs.getOrDefault("metric", METRIC_ORDERS))))
                    .payout(normalizePayout(String.valueOf(slabs.getOrDefault("payout", PAYOUT_PER_UNIT))))
                    .tiers(tiers)
                    .build());
        }
        if (map.get("franchise") instanceof Map<?, ?> franchiseRaw) {
            Map<String, Object> fr = (Map<String, Object>) franchiseRaw;
            String cadence = String.valueOf(fr.getOrDefault("cadence", "MONTHLY")).trim().toUpperCase();
            if (!List.of("MONTHLY", "QUARTERLY", "YEARLY", "LIFETIME").contains(cadence)) {
                cadence = "MONTHLY";
            }
            String effectiveFrom = fr.get("effectiveFrom") == null ? null : String.valueOf(fr.get("effectiveFrom")).trim();
            party.setFranchise(FranchiseTerms.builder()
                    .enabled(asBool(fr.get("enabled"), false))
                    .cadence(cadence)
                    .amount(asMoney(fr.get("amount")))
                    .effectiveFrom(effectiveFrom == null || effectiveFrom.isBlank() ? null : effectiveFrom)
                    .build());
        }
        return party;
    }

    private PeriodIncentive periodFrom(Map<String, Object> map) {
        return PeriodIncentive.builder()
                .enabled(asBool(map.get("enabled"), false))
                .amount(asMoney(map.get("amount")))
                .minCompletedOrders(asInt(map.get("minCompletedOrders"), 0))
                .build();
    }

    private static String normalizePeriodName(String raw) {
        return PERIOD_DAY.equalsIgnoreCase(raw) ? PERIOD_DAY : PERIOD_MONTH;
    }

    private static String normalizeMetric(String raw) {
        String v = raw == null ? METRIC_ORDERS : raw.trim().toUpperCase();
        if (METRIC_LAST_MILE.equals(v) || METRIC_ALL_TRIPS.equals(v)) {
            return v;
        }
        return METRIC_ORDERS;
    }

    private static String normalizePayout(String raw) {
        return PAYOUT_FLAT.equalsIgnoreCase(raw) ? PAYOUT_FLAT : PAYOUT_PER_UNIT;
    }

    private static BigDecimal money(BigDecimal raw, String label) {
        if (raw == null || raw.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " must be ₹0 or more");
        }
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal moneyOrZero(BigDecimal raw) {
        if (raw == null || raw.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO;
        }
        return raw;
    }

    private static BigDecimal asMoney(Object raw) {
        if (raw == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).setScale(2, RoundingMode.HALF_UP).max(BigDecimal.ZERO);
        }
        try {
            return new BigDecimal(String.valueOf(raw).trim()).setScale(2, RoundingMode.HALF_UP).max(BigDecimal.ZERO);
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
    }

    private static boolean asBool(Object raw, boolean fallback) {
        if (raw instanceof Boolean b) {
            return b;
        }
        if (raw == null) {
            return fallback;
        }
        return "true".equalsIgnoreCase(String.valueOf(raw).trim());
    }

    private static int asInt(Object raw, int fallback) {
        if (raw instanceof Number n) {
            return Math.max(0, n.intValue());
        }
        if (raw == null) {
            return fallback;
        }
        try {
            return Math.max(0, Integer.parseInt(String.valueOf(raw).trim()));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }
}
