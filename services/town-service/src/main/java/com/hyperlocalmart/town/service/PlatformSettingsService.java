package com.hyperlocalmart.town.service;

import com.hyperlocalmart.town.dto.response.MembershipConfigResponse;
import com.hyperlocalmart.town.dto.response.MembershipPackRevisionResponse;
import com.hyperlocalmart.town.entity.MembershipPackRevision;
import com.hyperlocalmart.town.entity.PlatformSetting;
import com.hyperlocalmart.town.legal.DefaultLegalDocuments;
import com.hyperlocalmart.town.repository.MembershipPackRevisionRepository;
import com.hyperlocalmart.town.repository.PlatformSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlatformSettingsService {

    public static final String KEY_PLATFORM = "platform";

    private final PlatformSettingRepository platformSettingRepository;
    private final MembershipPackRevisionRepository membershipPackRevisionRepository;
    private final AdminAuditor adminAuditService;

    @Transactional(readOnly = true)
    public Map<String, Object> getSettings() {
        Map<String, Object> merged = defaults();
        platformSettingRepository.findBySettingKey(KEY_PLATFORM)
                .ifPresent(row -> merged.putAll(row.getSettingValue()));
        return merged;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPublicSettings() {
        Map<String, Object> all = getSettings();
        Map<String, Object> pub = new LinkedHashMap<>();
        pub.put("termsUrl", all.getOrDefault("termsUrl", ""));
        pub.put("privacyUrl", all.getOrDefault("privacyUrl", ""));
        pub.put("refundUrl", all.getOrDefault("refundUrl", ""));
        pub.put("termsText", all.getOrDefault("termsText", DefaultLegalDocuments.terms()));
        pub.put("privacyText", all.getOrDefault("privacyText", DefaultLegalDocuments.privacy()));
        pub.put("refundText", all.getOrDefault("refundText", DefaultLegalDocuments.refund()));
        pub.put("legalVersion", asInt(all.get("legalVersion"), DefaultLegalDocuments.DEFAULT_VERSION));
        pub.put("legalUpdatedAt", all.getOrDefault("legalUpdatedAt", ""));
        pub.put("grievanceOfficer", all.getOrDefault("grievanceOfficer", ""));
        pub.put("supportPhone", all.getOrDefault("supportPhone", ""));
        pub.put("deliveryFee", all.getOrDefault("deliveryFee", 40));
        pub.put("vendorOrderAlertMessage",
                all.getOrDefault("vendorOrderAlertMessage", "Order received"));
        pub.put("membershipEnabled", asBool(all.get("membershipEnabled"), false));
        pub.put("membershipQuarterlyPrice", asMoney(all.get("membershipQuarterlyPrice")));
        pub.put("membershipQuarterlyCredits", asInt(all.get("membershipQuarterlyCredits"), 0));
        pub.put("membershipHalfYearPrice", asMoney(all.get("membershipHalfYearPrice")));
        pub.put("membershipHalfYearCredits", asInt(all.get("membershipHalfYearCredits"), 0));
        pub.put("membershipAnnualPrice", asMoney(all.get("membershipAnnualPrice")));
        pub.put("membershipAnnualCredits", asInt(all.get("membershipAnnualCredits"), 0));
        return pub;
    }

    @Transactional(readOnly = true)
    public MembershipConfigResponse getMembershipConfig() {
        Map<String, Object> all = getSettings();
        return MembershipConfigResponse.builder()
                .enabled(asBool(all.get("membershipEnabled"), false))
                .quarterly(MembershipConfigResponse.Slab.builder()
                        .code("QUARTERLY")
                        .months(3)
                        .price(asMoney(all.get("membershipQuarterlyPrice")))
                        .credits(asInt(all.get("membershipQuarterlyCredits"), 0))
                        .build())
                .halfYear(MembershipConfigResponse.Slab.builder()
                        .code("HALF_YEAR")
                        .months(6)
                        .price(asMoney(all.get("membershipHalfYearPrice")))
                        .credits(asInt(all.get("membershipHalfYearCredits"), 0))
                        .build())
                .annual(MembershipConfigResponse.Slab.builder()
                        .code("ANNUAL")
                        .months(12)
                        .price(asMoney(all.get("membershipAnnualPrice")))
                        .credits(asInt(all.get("membershipAnnualCredits"), 0))
                        .build())
                .build();
    }

    @Transactional
    public Map<String, Object> patchSettings(Map<String, Object> patch) {
        return patchSettings(patch, null);
    }

    @Transactional
    public Map<String, Object> patchSettings(Map<String, Object> patch, UUID actorId) {
        Map<String, Object> current = getSettings();
        Map<String, Object> before = new LinkedHashMap<>(current);
        PackSnap beforePacks = packSnap(current);
        if (patch != null) {
            patch = new LinkedHashMap<>(patch);
            if (patch.containsKey("deliveryFee")) {
                current.put("deliveryFee", normalizeDeliveryFee(patch.get("deliveryFee")));
                patch = new LinkedHashMap<>(patch);
                patch.remove("deliveryFee");
            }
            if (patch.containsKey("vendorOrderAlertMessage")) {
                current.put("vendorOrderAlertMessage",
                        normalizeAlertMessage(patch.get("vendorOrderAlertMessage")));
                if (!(patch instanceof LinkedHashMap)) {
                    patch = new LinkedHashMap<>(patch);
                }
                patch.remove("vendorOrderAlertMessage");
            }
            applyMembershipPatch(current, patch);
            applyLegalPatch(current, patch);
            current.putAll(patch);
        }
        PackSnap afterPacks = packSnap(current);
        if (!beforePacks.equals(afterPacks)) {
            recordPackRevision(beforePacks, afterPacks, actorId);
            adminAuditService.record(
                    "memberships",
                    "UPDATE_MEMBERSHIP_PACKS",
                    "Updated membership pack prices",
                    actorId,
                    "SUPER_ADMIN",
                    null,
                    "MEMBERSHIP_PACKS",
                    null,
                    before,
                    current);
        }
        PlatformSetting row = platformSettingRepository.findBySettingKey(KEY_PLATFORM)
                .orElseGet(() -> PlatformSetting.builder().settingKey(KEY_PLATFORM).build());
        row.setSettingValue(current);
        row.setUpdatedAt(Instant.now());
        if (row.getCreatedAt() == null) {
            row.setCreatedAt(Instant.now());
        }
        platformSettingRepository.save(row);
        adminAuditService.record(
                "settings",
                "UPDATE_PLATFORM_SETTINGS",
                "Updated platform settings",
                actorId,
                "SUPER_ADMIN",
                null,
                "PLATFORM_SETTINGS",
                null,
                before,
                current);
        return current;
    }

    @Transactional(readOnly = true)
    public List<MembershipPackRevisionResponse> listPackRevisions() {
        return membershipPackRevisionRepository.findTop50ByOrderByVersionNoDesc().stream()
                .map(this::toPackRevision)
                .toList();
    }

    private void recordPackRevision(PackSnap before, PackSnap after, UUID actorId) {
        Integer latest = membershipPackRevisionRepository.maxVersionNo();
        int next = (latest == null ? 0 : latest) + 1;
        membershipPackRevisionRepository.save(MembershipPackRevision.builder()
                .versionNo(next)
                .sellingEnabled(after.enabled)
                .quarterlyPrice(after.qPrice)
                .quarterlyCredits(after.qCredits)
                .halfYearPrice(after.hPrice)
                .halfYearCredits(after.hCredits)
                .annualPrice(after.aPrice)
                .annualCredits(after.aCredits)
                .changeSummary(summarizePackChange(before, after))
                .changedBy(actorId)
                .createdAt(Instant.now())
                .build());
    }

    private MembershipPackRevisionResponse toPackRevision(MembershipPackRevision row) {
        return MembershipPackRevisionResponse.builder()
                .id(row.getId())
                .versionNo(row.getVersionNo())
                .sellingEnabled(row.isSellingEnabled())
                .quarterlyPrice(row.getQuarterlyPrice())
                .quarterlyCredits(row.getQuarterlyCredits())
                .halfYearPrice(row.getHalfYearPrice())
                .halfYearCredits(row.getHalfYearCredits())
                .annualPrice(row.getAnnualPrice())
                .annualCredits(row.getAnnualCredits())
                .changeSummary(row.getChangeSummary())
                .changedBy(row.getChangedBy())
                .createdAt(row.getCreatedAt())
                .build();
    }

    private PackSnap packSnap(Map<String, Object> settings) {
        return new PackSnap(
                asBool(settings.get("membershipEnabled"), false),
                asMoney(settings.get("membershipQuarterlyPrice")),
                asInt(settings.get("membershipQuarterlyCredits"), 0),
                asMoney(settings.get("membershipHalfYearPrice")),
                asInt(settings.get("membershipHalfYearCredits"), 0),
                asMoney(settings.get("membershipAnnualPrice")),
                asInt(settings.get("membershipAnnualCredits"), 0));
    }

    private static String summarizePackChange(PackSnap before, PackSnap after) {
        List<String> bits = new ArrayList<>();
        if (before.enabled != after.enabled) {
            bits.add(after.enabled ? "Selling on" : "Selling off");
        }
        diffMoney(bits, "3 months", before.qPrice, after.qPrice);
        diffInt(bits, "3 months drops", before.qCredits, after.qCredits);
        diffMoney(bits, "6 months", before.hPrice, after.hPrice);
        diffInt(bits, "6 months drops", before.hCredits, after.hCredits);
        diffMoney(bits, "Annual", before.aPrice, after.aPrice);
        diffInt(bits, "Annual drops", before.aCredits, after.aCredits);
        if (bits.isEmpty()) {
            return "Packs updated";
        }
        String text = String.join(" · ", bits);
        return text.length() > 500 ? text.substring(0, 497) + "…" : text;
    }

    private static void diffMoney(List<String> bits, String label, BigDecimal from, BigDecimal to) {
        if (from.compareTo(to) != 0) {
            bits.add(label + " ₹" + from.toPlainString() + "→₹" + to.toPlainString());
        }
    }

    private static void diffInt(List<String> bits, String label, int from, int to) {
        if (from != to) {
            bits.add(label + " " + from + "→" + to);
        }
    }

    private record PackSnap(
            boolean enabled,
            BigDecimal qPrice,
            int qCredits,
            BigDecimal hPrice,
            int hCredits,
            BigDecimal aPrice,
            int aCredits) {
    }

    private Map<String, Object> defaults() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("mapsEnabled", false);
        map.put("maintenanceMode", false);
        map.put("termsUrl", "");
        map.put("privacyUrl", "");
        map.put("refundUrl", "");
        map.put("termsText", DefaultLegalDocuments.terms());
        map.put("privacyText", DefaultLegalDocuments.privacy());
        map.put("refundText", DefaultLegalDocuments.refund());
        map.put("legalVersion", DefaultLegalDocuments.DEFAULT_VERSION);
        map.put("legalUpdatedAt", "");
        map.put("grievanceOfficer", "");
        map.put("supportPhone", "9876500100");
        // Platform-wide buyer delivery fee (₹) — not town-specific.
        map.put("deliveryFee", 40);
        // Spoken and displayed to every vendor, regardless of town.
        map.put("vendorOrderAlertMessage", "Order received");
        map.put("membershipEnabled", false);
        map.put("membershipQuarterlyPrice", 0);
        map.put("membershipQuarterlyCredits", 0);
        map.put("membershipHalfYearPrice", 0);
        map.put("membershipHalfYearCredits", 0);
        map.put("membershipAnnualPrice", 0);
        map.put("membershipAnnualCredits", 0);
        return map;
    }

    @Transactional(readOnly = true)
    public java.math.BigDecimal resolveDeliveryFee() {
        Object raw = getSettings().get("deliveryFee");
        if (raw instanceof Number n) {
            return java.math.BigDecimal.valueOf(n.doubleValue())
                    .setScale(2, java.math.RoundingMode.HALF_UP);
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new java.math.BigDecimal(s.trim()).setScale(2, java.math.RoundingMode.HALF_UP);
        }
        return new java.math.BigDecimal("40.00");
    }

    private double normalizeDeliveryFee(Object raw) {
        double value;
        if (raw instanceof Number n) {
            value = n.doubleValue();
        } else if (raw instanceof String s && !s.isBlank()) {
            value = Double.parseDouble(s.trim());
        } else {
            value = 40;
        }
        if (value < 0 || Double.isNaN(value) || Double.isInfinite(value)) {
            throw new IllegalArgumentException("deliveryFee must be a non-negative number");
        }
        // Store as whole paise-friendly 2dp via rounding
        return Math.round(value * 100.0) / 100.0;
    }

    private void applyLegalPatch(Map<String, Object> current, Map<String, Object> patch) {
        if (patch == null) {
            return;
        }
        if (asBool(patch.get("resetLegalDefaults"), false)) {
            patch.remove("resetLegalDefaults");
            current.put("termsText", DefaultLegalDocuments.terms());
            current.put("privacyText", DefaultLegalDocuments.privacy());
            current.put("refundText", DefaultLegalDocuments.refund());
            patch.remove("termsText");
            patch.remove("privacyText");
            patch.remove("refundText");
            current.put("legalVersion", asInt(current.get("legalVersion"), DefaultLegalDocuments.DEFAULT_VERSION) + 1);
            current.put("legalUpdatedAt", Instant.now().toString());
            patch.remove("legalVersion");
            patch.remove("legalUpdatedAt");
            return;
        }
        patch.remove("resetLegalDefaults");
        boolean changed = false;
        changed |= putNormalizedLegal(current, patch, "termsText");
        changed |= putNormalizedLegal(current, patch, "privacyText");
        changed |= putNormalizedLegal(current, patch, "refundText");
        if (changed) {
            current.put("legalVersion", asInt(current.get("legalVersion"), DefaultLegalDocuments.DEFAULT_VERSION) + 1);
            current.put("legalUpdatedAt", Instant.now().toString());
        }
        patch.remove("legalVersion");
        patch.remove("legalUpdatedAt");
    }

    private boolean putNormalizedLegal(Map<String, Object> current, Map<String, Object> patch, String key) {
        if (!patch.containsKey(key)) {
            return false;
        }
        String next = normalizeLegalText(patch.get(key), key);
        patch.remove(key);
        String previous = current.get(key) == null ? "" : String.valueOf(current.get(key));
        if (Objects.equals(previous, next)) {
            return false;
        }
        current.put(key, next);
        return true;
    }

    private String normalizeLegalText(Object raw, String key) {
        String value = raw == null ? "" : raw.toString().trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException(key + " cannot be empty");
        }
        if (value.length() > DefaultLegalDocuments.MAX_CHARS) {
            throw new IllegalArgumentException(key + " must be at most " + DefaultLegalDocuments.MAX_CHARS + " characters");
        }
        return value;
    }

    private void applyMembershipPatch(Map<String, Object> current, Map<String, Object> patch) {
        if (patch == null) {
            return;
        }
        if (!(patch instanceof LinkedHashMap)) {
            // caller may replace patch; we only strip known keys from a copy if needed
        }
        if (patch.containsKey("membershipEnabled")) {
            current.put("membershipEnabled", asBool(patch.get("membershipEnabled"), false));
            patch.remove("membershipEnabled");
        }
        putNormalizedMoney(current, patch, "membershipQuarterlyPrice");
        putNormalizedMoney(current, patch, "membershipHalfYearPrice");
        putNormalizedMoney(current, patch, "membershipAnnualPrice");
        putNormalizedInt(current, patch, "membershipQuarterlyCredits");
        putNormalizedInt(current, patch, "membershipHalfYearCredits");
        putNormalizedInt(current, patch, "membershipAnnualCredits");
    }

    private void putNormalizedMoney(Map<String, Object> current, Map<String, Object> patch, String key) {
        if (!patch.containsKey(key)) {
            return;
        }
        current.put(key, asMoney(patch.get(key)));
        patch.remove(key);
    }

    private void putNormalizedInt(Map<String, Object> current, Map<String, Object> patch, String key) {
        if (!patch.containsKey(key)) {
            return;
        }
        int value = asInt(patch.get(key), 0);
        if (value < 0) {
            throw new IllegalArgumentException(key + " must be 0 or more");
        }
        current.put(key, value);
        patch.remove(key);
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
            return n.intValue();
        }
        if (raw instanceof String s && !s.isBlank()) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static BigDecimal asMoney(Object raw) {
        BigDecimal value;
        if (raw instanceof Number n) {
            value = BigDecimal.valueOf(n.doubleValue());
        } else if (raw instanceof String s && !s.isBlank()) {
            value = new BigDecimal(s.trim());
        } else {
            value = BigDecimal.ZERO;
        }
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Membership price must be ₹0 or more");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizeAlertMessage(Object raw) {
        String value = raw == null ? "" : raw.toString().trim();
        if (value.isEmpty()) {
            return "Order received";
        }
        if (value.length() > 120) {
            throw new IllegalArgumentException("vendorOrderAlertMessage must be at most 120 characters");
        }
        return value;
    }
}
