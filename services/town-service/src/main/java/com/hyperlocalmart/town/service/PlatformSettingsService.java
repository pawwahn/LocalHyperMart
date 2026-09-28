package com.hyperlocalmart.town.service;

import com.hyperlocalmart.town.dto.request.AdminAuditAppendRequest;
import com.hyperlocalmart.town.dto.response.MembershipConfigResponse;
import com.hyperlocalmart.town.dto.response.ReferralConfigResponse;
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
        pub.put("supplierLegalName", all.getOrDefault("supplierLegalName", "HyperLocalMart"));
        pub.put("supplierGstin", all.getOrDefault("supplierGstin", ""));
        pub.put("supplierAddress", all.getOrDefault("supplierAddress", ""));
        pub.put("supplierState", all.getOrDefault("supplierState", ""));
        pub.put("supplierGstStateCode", all.getOrDefault("supplierGstStateCode", ""));
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
        pub.put("referralsEnabled", asBool(all.get("referralsEnabled"), false));
        pub.put("mealPlannerEnabled", asBool(all.get("mealPlannerEnabled"), false));
        return pub;
    }

    @Transactional(readOnly = true)
    public ReferralConfigResponse getReferralConfig() {
        Map<String, Object> all = getSettings();
        return ReferralConfigResponse.builder()
                .enabled(asBool(all.get("referralsEnabled"), false))
                .referrerRewardAmount(asMoney(all.get("referralReferrerRewardAmount")))
                .refereeRewardAmount(asMoney(all.get("referralRefereeRewardAmount")))
                .shareBaseUrl(asString(all.get("referralShareBaseUrl")))
                .shareMessageTemplate(asString(all.get("referralShareMessageTemplate")))
                .build();
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
            if (patch.containsKey("supplierGstin")) {
                current.put("supplierGstin", normalizeGstin(patch.get("supplierGstin")));
                patch.remove("supplierGstin");
            }
            if (patch.containsKey("supplierGstStateCode")) {
                current.put("supplierGstStateCode", normalizeGstStateCode(patch.get("supplierGstStateCode")));
                patch.remove("supplierGstStateCode");
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
            List<String> packLines = membershipChangeLines(before, current);
            AdminAuditAppendRequest packAudit = new AdminAuditAppendRequest();
            packAudit.setScreenKey("memberships");
            packAudit.setAction("UPDATE_MEMBERSHIP_PACKS");
            packAudit.setChangeSummary(packLines.isEmpty()
                    ? "Updated membership packs"
                    : String.join("; ", packLines));
            packAudit.setActorUserId(actorId);
            packAudit.setActorRole("SUPER_ADMIN");
            packAudit.setEntityType("MEMBERSHIP_PACKS");
            packAudit.setBeforeSnapshot(membershipSnapshot(before));
            packAudit.setAfterSnapshot(membershipSnapshot(current));
            packAudit.setChangeLines(packLines);
            adminAuditService.record(packAudit);
        }
        PlatformSetting row = platformSettingRepository.findBySettingKey(KEY_PLATFORM)
                .orElseGet(() -> PlatformSetting.builder().settingKey(KEY_PLATFORM).build());
        row.setSettingValue(current);
        row.setUpdatedAt(Instant.now());
        if (row.getCreatedAt() == null) {
            row.setCreatedAt(Instant.now());
        }
        platformSettingRepository.save(row);
        String changeSummary = settingsChangeSummary(before, current);
        adminAuditService.record(
                "settings",
                "UPDATE_PLATFORM_SETTINGS",
                changeSummary,
                actorId,
                "SUPER_ADMIN",
                null,
                "PLATFORM_SETTINGS",
                null,
                before,
                current);
        return current;
    }

    /** Membership-only old → new lines. Each line is "Label: old → new". */
    public static List<String> membershipChangeLines(Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> left = before != null ? before : Map.of();
        Map<String, Object> right = after != null ? after : Map.of();
        List<String> parts = new ArrayList<>();
        valuedBool(parts, "Membership sales", left.get("membershipEnabled"), right.get("membershipEnabled"));
        valuedMoney(parts, "3 month price", left.get("membershipQuarterlyPrice"), right.get("membershipQuarterlyPrice"));
        valuedInt(parts, "3 month deliveries", left.get("membershipQuarterlyCredits"), right.get("membershipQuarterlyCredits"));
        valuedMoney(parts, "6 month price", left.get("membershipHalfYearPrice"), right.get("membershipHalfYearPrice"));
        valuedInt(parts, "6 month deliveries", left.get("membershipHalfYearCredits"), right.get("membershipHalfYearCredits"));
        valuedMoney(parts, "Annual price", left.get("membershipAnnualPrice"), right.get("membershipAnnualPrice"));
        valuedInt(parts, "Annual deliveries", left.get("membershipAnnualCredits"), right.get("membershipAnnualCredits"));
        valuedPlain(parts, "Status", left.get("status"), right.get("status"));
        valuedPlain(parts, "Phone", left.get("phone"), right.get("phone"));
        valuedPlain(parts, "Slab", left.get("slab"), right.get("slab"));
        valuedInt(parts, "Credits", left.get("credits"), right.get("credits"));
        return parts;
    }

    public static Map<String, Object> membershipSnapshot(Map<String, Object> source) {
        Map<String, Object> snap = new LinkedHashMap<>();
        if (source == null) {
            return snap;
        }
        for (String key : List.of(
                "membershipEnabled",
                "membershipQuarterlyPrice",
                "membershipQuarterlyCredits",
                "membershipHalfYearPrice",
                "membershipHalfYearCredits",
                "membershipAnnualPrice",
                "membershipAnnualCredits")) {
            if (source.containsKey(key)) {
                snap.put(key, source.get(key));
            }
        }
        return snap;
    }

    private static void valuedBool(List<String> parts, String label, Object before, Object after) {
        if (Objects.equals(auditNormalizeBool(before), auditNormalizeBool(after))) {
            return;
        }
        parts.add(label + ": " + auditBoolLabel(before) + " → " + auditBoolLabel(after));
    }

    private static void valuedMoney(List<String> parts, String label, Object before, Object after) {
        String left = auditMoneyLabel(before);
        String right = auditMoneyLabel(after);
        if (!Objects.equals(left, right)) {
            parts.add(label + ": " + left + " → " + right);
        }
    }

    private static void valuedInt(List<String> parts, String label, Object before, Object after) {
        String left = before == null ? "—" : String.valueOf(asInt(before, 0));
        String right = after == null ? "—" : String.valueOf(asInt(after, 0));
        if (!Objects.equals(left, right)) {
            parts.add(label + ": " + left + " → " + right);
        }
    }

    private static void valuedPlain(List<String> parts, String label, Object before, Object after) {
        String left = before == null || String.valueOf(before).isBlank() ? "—" : String.valueOf(before).trim();
        String right = after == null || String.valueOf(after).isBlank() ? "—" : String.valueOf(after).trim();
        if (before == null && after == null) {
            return;
        }
        if (!Objects.equals(left, right)) {
            parts.add(label + ": " + left + " → " + right);
        }
    }

    /** Human-readable diff lines for platform settings audit (excludes full legal body text). */
    public static List<String> settingsChangeParts(Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> left = before != null ? before : Map.of();
        Map<String, Object> right = after != null ? after : Map.of();
        List<String> parts = new ArrayList<>();
        auditBool(parts, "Referrals", left.get("referralsEnabled"), right.get("referralsEnabled"));
        auditMoney(parts, "Referrer reward", left.get("referralReferrerRewardAmount"), right.get("referralReferrerRewardAmount"));
        auditMoney(parts, "Referee reward", left.get("referralRefereeRewardAmount"), right.get("referralRefereeRewardAmount"));
        auditPlain(parts, "Referral share URL", left.get("referralShareBaseUrl"), right.get("referralShareBaseUrl"));
        if (!auditTextSame(left.get("referralShareMessageTemplate"), right.get("referralShareMessageTemplate"))) {
            parts.add("Referral share message updated");
        }
        auditMoney(parts, "Delivery fee", left.get("deliveryFee"), right.get("deliveryFee"));
        auditPlain(parts, "Vendor alert", left.get("vendorOrderAlertMessage"), right.get("vendorOrderAlertMessage"));
        auditBool(parts, "Maps", left.get("mapsEnabled"), right.get("mapsEnabled"));
        auditBool(parts, "Maintenance", left.get("maintenanceMode"), right.get("maintenanceMode"));
        auditBool(parts, "Meal planner", left.get("mealPlannerEnabled"), right.get("mealPlannerEnabled"));
        auditBool(parts, "Hub admin agent ratings", left.get("hubAdminCanSeeAgentRatings"), right.get("hubAdminCanSeeAgentRatings"));
        auditPlain(parts, "Support phone", left.get("supportPhone"), right.get("supportPhone"));
        auditPlain(parts, "Bill legal name", left.get("supplierLegalName"), right.get("supplierLegalName"));
        auditPlain(parts, "Bill GSTIN", left.get("supplierGstin"), right.get("supplierGstin"));
        auditPlain(parts, "Bill address", left.get("supplierAddress"), right.get("supplierAddress"));
        auditPlain(parts, "Bill state", left.get("supplierState"), right.get("supplierState"));
        auditPlain(parts, "Bill GST state", left.get("supplierGstStateCode"), right.get("supplierGstStateCode"));
        auditPlain(parts, "Grievance officer", left.get("grievanceOfficer"), right.get("grievanceOfficer"));
        auditPlain(parts, "Terms URL", left.get("termsUrl"), right.get("termsUrl"));
        auditPlain(parts, "Privacy URL", left.get("privacyUrl"), right.get("privacyUrl"));
        auditPlain(parts, "Refund URL", left.get("refundUrl"), right.get("refundUrl"));
        auditBool(parts, "Membership sales", left.get("membershipEnabled"), right.get("membershipEnabled"));
        auditMoney(parts, "Membership Q price", left.get("membershipQuarterlyPrice"), right.get("membershipQuarterlyPrice"));
        auditInt(parts, "Membership Q credits", left.get("membershipQuarterlyCredits"), right.get("membershipQuarterlyCredits"));
        auditMoney(parts, "Membership 6M price", left.get("membershipHalfYearPrice"), right.get("membershipHalfYearPrice"));
        auditInt(parts, "Membership 6M credits", left.get("membershipHalfYearCredits"), right.get("membershipHalfYearCredits"));
        auditMoney(parts, "Membership annual price", left.get("membershipAnnualPrice"), right.get("membershipAnnualPrice"));
        auditInt(parts, "Membership annual credits", left.get("membershipAnnualCredits"), right.get("membershipAnnualCredits"));
        if (!auditTextSame(left.get("termsText"), right.get("termsText"))
                || !auditTextSame(left.get("privacyText"), right.get("privacyText"))
                || !auditTextSame(left.get("refundText"), right.get("refundText"))) {
            parts.add("Legal copy v"
                    + auditScalar(left.get("legalVersion"))
                    + " → v"
                    + auditScalar(right.get("legalVersion")));
        } else if (!Objects.equals(left.get("legalVersion"), right.get("legalVersion"))) {
            auditPlain(parts, "Legal version", left.get("legalVersion"), right.get("legalVersion"));
        }
        return parts;
    }

    public static String settingsChangeSummary(Map<String, Object> before, Map<String, Object> after) {
        List<String> parts = settingsChangeParts(before, after);
        if (parts.isEmpty()) {
            return "Updated platform settings";
        }
        String summary = String.join("; ", parts);
        return summary.length() <= 500 ? summary : summary.substring(0, 500);
    }

    private static void auditBool(List<String> parts, String label, Object before, Object after) {
        if (Objects.equals(auditNormalizeBool(before), auditNormalizeBool(after))) {
            return;
        }
        parts.add(label + " " + auditBoolLabel(before) + " → " + auditBoolLabel(after));
    }

    private static Boolean auditNormalizeBool(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Boolean b) {
            return b;
        }
        return "true".equalsIgnoreCase(String.valueOf(raw).trim());
    }

    private static String auditBoolLabel(Object raw) {
        if (raw == null) {
            return "not set";
        }
        return auditNormalizeBool(raw) ? "on" : "off";
    }

    private static void auditMoney(List<String> parts, String label, Object before, Object after) {
        String left = auditMoneyLabel(before);
        String right = auditMoneyLabel(after);
        if (!Objects.equals(left, right)) {
            parts.add(label + " " + left + " → " + right);
        }
    }

    private static String auditMoneyLabel(Object raw) {
        if (raw == null) {
            return "—";
        }
        BigDecimal value;
        if (raw instanceof Number n) {
            value = BigDecimal.valueOf(n.doubleValue());
        } else if (raw instanceof String s && !s.isBlank()) {
            value = new BigDecimal(s.trim());
        } else {
            return String.valueOf(raw);
        }
        return "₹" + value.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static void auditInt(List<String> parts, String label, Object before, Object after) {
        String left = auditScalar(before);
        String right = auditScalar(after);
        if (!Objects.equals(left, right)) {
            parts.add(label + " " + left + " → " + right);
        }
    }

    private static void auditPlain(List<String> parts, String label, Object before, Object after) {
        String left = auditScalar(before);
        String right = auditScalar(after);
        if (!Objects.equals(left, right)) {
            String snippet = right.length() > 48 ? right.substring(0, 45) + "…" : right;
            parts.add(label + " → " + snippet);
        }
    }

    private static String auditScalar(Object raw) {
        if (raw == null) {
            return "—";
        }
        String s = String.valueOf(raw).trim();
        return s.isEmpty() ? "—" : s;
    }

    private static boolean auditTextSame(Object before, Object after) {
        return Objects.equals(auditScalar(before), auditScalar(after));
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
        map.put("supplierLegalName", "HyperLocalMart");
        map.put("supplierGstin", "");
        map.put("supplierAddress", "");
        map.put("supplierState", "");
        map.put("supplierGstStateCode", "");
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
        map.put("referralsEnabled", false);
        map.put("referralReferrerRewardAmount", 0);
        map.put("referralRefereeRewardAmount", 0);
        map.put("referralShareBaseUrl", "");
        map.put("referralShareMessageTemplate",
                "Order groceries from local shops on HyperLocalMart. Use my code {code}: {link}");
        map.put("mealPlannerEnabled", false);
        map.put("hubAdminCanSeeAgentRatings", true);
        return map;
    }

    @Transactional(readOnly = true)
    public boolean hubAdminCanSeeAgentRatings() {
        return asBool(getSettings().get("hubAdminCanSeeAgentRatings"), true);
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

    private static String normalizeGstin(Object raw) {
        if (raw == null) {
            return "";
        }
        String value = String.valueOf(raw).trim().toUpperCase(java.util.Locale.ROOT).replace(" ", "");
        if (value.isEmpty()) {
            return "";
        }
        if (!value.matches("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")) {
            throw new IllegalArgumentException("GSTIN must be 15 characters");
        }
        return value;
    }

    private static String normalizeGstStateCode(Object raw) {
        if (raw == null) {
            return "";
        }
        String value = String.valueOf(raw).trim();
        if (value.isEmpty()) {
            return "";
        }
        if (!value.matches("^[0-9]{2}$")) {
            throw new IllegalArgumentException("GST state code must be 2 digits, for example 37");
        }
        return value;
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

    private static String asString(Object raw) {
        return raw == null ? "" : String.valueOf(raw).trim();
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
