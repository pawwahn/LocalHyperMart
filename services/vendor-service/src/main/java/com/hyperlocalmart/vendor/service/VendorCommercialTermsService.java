package com.hyperlocalmart.vendor.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.CommercialTermsQuoteRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertVendorCommercialTermsRequest;
import com.hyperlocalmart.vendor.dto.response.CommercialTermsQuoteResponse;
import com.hyperlocalmart.vendor.dto.response.VendorCommercialTermsListResponse;
import com.hyperlocalmart.vendor.dto.response.VendorCommercialTermsResponse;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.entity.VendorCommercialTerms;
import com.hyperlocalmart.vendor.entity.VendorFeeModel;
import com.hyperlocalmart.vendor.repository.VendorCommercialTermsRepository;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorCommercialTermsService {

    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final VendorCommercialTermsRepository termsRepository;
    private final VendorRepository vendorRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public VendorCommercialTermsResponse ensureDefault(UUID vendorId, UUID actorId) {
        return termsRepository.findByVendorIdAndEffectiveToIsNull(vendorId)
                .map(this::toResponse)
                .orElseGet(() -> {
                    VendorCommercialTerms terms = VendorCommercialTerms.builder()
                            .vendorId(vendorId)
                            .feeModel(VendorFeeModel.NONE)
                            .effectiveFrom(LocalDate.now(IST))
                            .build();
                    terms.setCreatedBy(actorId);
                    terms.setUpdatedBy(actorId);
                    return toResponse(termsRepository.save(terms));
                });
    }

    @Transactional(readOnly = true)
    public VendorCommercialTermsResponse get(UUID vendorId) {
        requireVendor(vendorId);
        return currentTerms(vendorId)
                .map(this::toResponse)
                .orElseGet(() -> emptyCurrent(vendorId));
    }

    @Transactional(readOnly = true)
    public VendorCommercialTermsListResponse list(UUID vendorId) {
        requireVendor(vendorId);
        List<VendorCommercialTermsResponse> history = termsRepository
                .findByVendorIdOrderByEffectiveFromDesc(vendorId)
                .stream()
                .map(this::toResponse)
                .toList();
        VendorCommercialTermsResponse current = history.stream()
                .filter(VendorCommercialTermsResponse::isCurrent)
                .findFirst()
                .orElseGet(() -> emptyCurrent(vendorId));
        return VendorCommercialTermsListResponse.builder()
                .current(current)
                .history(history)
                .build();
    }

    /**
     * Saving creates a new version from {@code effectiveFrom} (default today) and
     * closes the previous open version the day before — so older orders keep old rates.
     */
    @Transactional
    public VendorCommercialTermsResponse upsert(UUID vendorId, UUID actorId, UpsertVendorCommercialTermsRequest request) {
        requireVendor(vendorId);
        validateRequest(request);

        LocalDate from = request.getEffectiveFrom() == null ? LocalDate.now(IST) : request.getEffectiveFrom();
        VendorCommercialTerms open = termsRepository.findByVendorIdAndEffectiveToIsNull(vendorId).orElse(null);

        if (open != null) {
            // Same-day correction: overwrite current open row if effectiveFrom matches.
            if (open.getEffectiveFrom().equals(from)) {
                applyFields(open, request, from);
                open.setUpdatedBy(actorId);
                return toResponse(termsRepository.save(open));
            }
            if (from.isBefore(open.getEffectiveFrom())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Effective from must be on or after the current version start ("
                                + open.getEffectiveFrom() + ")");
            }
            LocalDate closeOn = from.minusDays(1);
            if (closeOn.isBefore(open.getEffectiveFrom())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "New terms would leave a gap; pick a later effective from date");
            }
            open.setEffectiveTo(closeOn);
            open.setUpdatedBy(actorId);
            termsRepository.save(open);
        }

        VendorCommercialTerms next = VendorCommercialTerms.builder()
                .vendorId(vendorId)
                .lastSubscriptionChargedYm(open == null ? null : open.getLastSubscriptionChargedYm())
                .build();
        applyFields(next, request, from);
        next.setCreatedBy(actorId);
        next.setUpdatedBy(actorId);
        return toResponse(termsRepository.save(next));
    }

    @Transactional
    public CommercialTermsQuoteResponse quote(UUID vendorId, CommercialTermsQuoteRequest request) {
        requireVendor(vendorId);

        List<DatedLine> datedLines = resolveLines(request);
        Map<UUID, Bucket> buckets = new LinkedHashMap<>();
        List<String> lines = new ArrayList<>();

        for (DatedLine line : datedLines) {
            VendorCommercialTerms terms = termsForDate(vendorId, line.date());
            UUID key = terms == null ? NULL_TERMS_ID : terms.getId();
            Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket(terms));
            bucket.gross = bucket.gross.add(line.amount());
            bucket.orderCount += 1;
        }

        BigDecimal commission = BigDecimal.ZERO;
        String slabLabel = null;
        for (Bucket bucket : buckets.values()) {
            FeePart part = computeOrderFees(bucket.terms, bucket.gross, bucket.orderCount);
            commission = commission.add(part.commission());
            lines.addAll(part.lines());
            if (part.slabLabel() != null) {
                slabLabel = part.slabLabel();
            }
        }

        VendorCommercialTerms subTerms = termsForDate(
                vendorId, request.getPeriodEnd() == null ? LocalDate.now(IST) : request.getPeriodEnd());
        BigDecimal subscription = BigDecimal.ZERO;
        boolean subscriptionIncluded = false;
        if (subTerms != null
                && (subTerms.getFeeModel() == VendorFeeModel.MONTHLY_SUBSCRIPTION
                || subTerms.getFeeModel() == VendorFeeModel.HYBRID)) {
            subscription = subscriptionDue(subTerms, request.getPeriodEnd(), request.isMarkSubscriptionCharged());
            subscriptionIncluded = subscription.compareTo(BigDecimal.ZERO) > 0;
            if (subscriptionIncluded) {
                lines.add("Monthly subscription ₹" + subscription.toPlainString()
                        + " (terms as of " + (request.getPeriodEnd() == null ? LocalDate.now(IST) : request.getPeriodEnd())
                        + ")");
            } else if (nz(subTerms.getMonthlySubscriptionAmount()).compareTo(BigDecimal.ZERO) > 0) {
                lines.add("Monthly subscription already charged for this month (or not due)");
            }
        }

        BigDecimal gross = datedLines.stream().map(DatedLine::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (datedLines.isEmpty()) {
            gross = nz(request.getGrossAmount());
        }
        BigDecimal total = commission.add(subscription).setScale(2, RoundingMode.HALF_UP);
        if (total.compareTo(gross) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Computed fees (₹" + total.toPlainString() + ") exceed gross (₹" + gross.toPlainString() + ")");
        }

        VendorFeeModel displayModel = buckets.size() == 1
                ? buckets.values().iterator().next().terms == null
                ? VendorFeeModel.NONE
                : buckets.values().iterator().next().terms.getFeeModel()
                : VendorFeeModel.NONE;
        if (buckets.size() > 1) {
            lines.add(0, "Mixed terms versions across order dates — fees split by order day");
        }

        return CommercialTermsQuoteResponse.builder()
                .vendorId(vendorId)
                .feeModel(displayModel)
                .grossAmount(gross)
                .orderCount(datedLines.isEmpty() ? nzInt(request.getOrderCount()) : datedLines.size())
                .commissionAmount(commission.setScale(2, RoundingMode.HALF_UP))
                .subscriptionAmount(subscription)
                .totalFeeAmount(total)
                .suggestedNet(gross.subtract(total).max(BigDecimal.ZERO))
                .subscriptionIncluded(subscriptionIncluded)
                .appliedSlabLabel(slabLabel)
                .breakdownLines(lines)
                .build();
    }

    private List<DatedLine> resolveLines(CommercialTermsQuoteRequest request) {
        if (request.getOrderLines() != null && !request.getOrderLines().isEmpty()) {
            List<DatedLine> out = new ArrayList<>();
            for (CommercialTermsQuoteRequest.OrderLine line : request.getOrderLines()) {
                LocalDate date = line.getOrderDate();
                if (date == null && line.getPlacedAt() != null) {
                    date = line.getPlacedAt().atZone(IST).toLocalDate();
                }
                if (date == null) {
                    date = request.getPeriodEnd() == null ? LocalDate.now(IST) : request.getPeriodEnd();
                }
                out.add(new DatedLine(nz(line.getAmount()), date));
            }
            return out;
        }
        // Legacy aggregate: apply current (period-end) terms to whole gross.
        BigDecimal gross = nz(request.getGrossAmount());
        int count = nzInt(request.getOrderCount());
        if (gross.compareTo(BigDecimal.ZERO) <= 0 && count <= 0) {
            return List.of();
        }
        LocalDate date = request.getPeriodEnd() == null ? LocalDate.now(IST) : request.getPeriodEnd();
        List<DatedLine> synthetic = new ArrayList<>();
        if (count <= 0) {
            synthetic.add(new DatedLine(gross, date));
            return synthetic;
        }
        BigDecimal each = gross.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        BigDecimal allocated = BigDecimal.ZERO;
        for (int i = 0; i < count; i++) {
            BigDecimal amt = i == count - 1 ? gross.subtract(allocated) : each;
            allocated = allocated.add(amt);
            synthetic.add(new DatedLine(amt, date));
        }
        return synthetic;
    }

    private FeePart computeOrderFees(VendorCommercialTerms terms, BigDecimal gross, int orderCount) {
        if (terms == null || terms.getFeeModel() == VendorFeeModel.NONE) {
            return new FeePart(BigDecimal.ZERO, List.of("No fee (" + orderCount + " orders)"), null);
        }
        String range = terms.getEffectiveFrom()
                + " → "
                + (terms.getEffectiveTo() == null ? "open" : terms.getEffectiveTo());
        List<String> lines = new ArrayList<>();
        return switch (terms.getFeeModel()) {
            case PER_ORDER_FLAT -> {
                BigDecimal flat = nz(terms.getPerOrderFlatAmount());
                BigDecimal commission = flat.multiply(BigDecimal.valueOf(orderCount)).setScale(2, RoundingMode.HALF_UP);
                lines.add(orderCount + " orders × ₹" + flat.toPlainString() + " flat [" + range + "]");
                yield new FeePart(commission, lines, null);
            }
            case COMMISSION_PCT, HYBRID -> {
                BigDecimal pct = nz(terms.getCommissionPercent());
                BigDecimal commission = percentOf(gross, pct);
                lines.add(pct.toPlainString() + "% of ₹" + gross.toPlainString() + " [" + range + "]");
                yield new FeePart(commission, lines, null);
            }
            case SLAB_COMMISSION -> {
                SlabPick pick = pickSlab(gross, readSlabs(terms.getCommissionSlabsJson()));
                BigDecimal commission = percentOf(gross, pick.percent());
                lines.add("Slab " + pick.label() + " → " + pick.percent().toPlainString()
                        + "% of ₹" + gross.toPlainString() + " [" + range + "]");
                yield new FeePart(commission, lines, pick.label());
            }
            case MONTHLY_SUBSCRIPTION -> new FeePart(BigDecimal.ZERO,
                    List.of(orderCount + " orders under monthly plan [" + range + "] — order fee ₹0"), null);
            case NONE -> new FeePart(BigDecimal.ZERO, List.of(), null);
        };
    }

    private VendorCommercialTerms termsForDate(UUID vendorId, LocalDate onDate) {
        List<VendorCommercialTerms> covering = termsRepository.findCoveringDate(vendorId, onDate);
        if (!covering.isEmpty()) {
            return covering.getFirst();
        }
        // Before first version: treat as NONE.
        return null;
    }

    private java.util.Optional<VendorCommercialTerms> currentTerms(UUID vendorId) {
        return termsRepository.findByVendorIdAndEffectiveToIsNull(vendorId)
                .or(() -> termsRepository.findCoveringDate(vendorId, LocalDate.now(IST)).stream().findFirst());
    }

    private void applyFields(VendorCommercialTerms terms, UpsertVendorCommercialTermsRequest request, LocalDate from) {
        terms.setFeeModel(request.getFeeModel());
        terms.setCommissionPercent(normalizeMoney(request.getCommissionPercent(), 4));
        terms.setPerOrderFlatAmount(normalizeMoney(request.getPerOrderFlatAmount(), 2));
        terms.setMonthlySubscriptionAmount(normalizeMoney(request.getMonthlySubscriptionAmount(), 2));
        terms.setSubscriptionBillingDay(request.getSubscriptionBillingDay());
        terms.setCommissionSlabsJson(writeSlabs(request.getCommissionSlabs()));
        terms.setNotes(blankToNull(request.getNotes()));
        terms.setEffectiveFrom(from);
        terms.setEffectiveTo(null);
    }

    private BigDecimal subscriptionDue(VendorCommercialTerms terms, LocalDate periodEnd, boolean markCharged) {
        BigDecimal amount = nz(terms.getMonthlySubscriptionAmount());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        LocalDate ref = periodEnd == null ? LocalDate.now(IST) : periodEnd;
        String ym = ref.format(YM);
        // Subscription charge flag lives on the open version (copied forward on change).
        VendorCommercialTerms open = termsRepository.findByVendorIdAndEffectiveToIsNull(terms.getVendorId())
                .orElse(terms);
        if (ym.equals(open.getLastSubscriptionChargedYm())) {
            return BigDecimal.ZERO;
        }
        if (markCharged) {
            open.setLastSubscriptionChargedYm(ym);
            termsRepository.save(open);
        }
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private void validateRequest(UpsertVendorCommercialTermsRequest request) {
        VendorFeeModel model = request.getFeeModel();
        switch (model) {
            case PER_ORDER_FLAT -> {
                if (nz(request.getPerOrderFlatAmount()).compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Per-order flat amount is required");
                }
            }
            case COMMISSION_PCT -> {
                if (nz(request.getCommissionPercent()).compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Commission percent is required");
                }
            }
            case SLAB_COMMISSION -> {
                if (request.getCommissionSlabs() == null || request.getCommissionSlabs().isEmpty()) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At least one commission slab is required");
                }
            }
            case MONTHLY_SUBSCRIPTION -> {
                if (nz(request.getMonthlySubscriptionAmount()).compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Monthly subscription amount is required");
                }
            }
            case HYBRID -> {
                if (nz(request.getCommissionPercent()).compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hybrid requires commission percent");
                }
                if (nz(request.getMonthlySubscriptionAmount()).compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hybrid requires monthly subscription amount");
                }
            }
            case NONE -> {
            }
        }
    }

    private Vendor requireVendor(UUID vendorId) {
        return vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
    }

    private VendorCommercialTermsResponse emptyCurrent(UUID vendorId) {
        return VendorCommercialTermsResponse.builder()
                .vendorId(vendorId)
                .feeModel(VendorFeeModel.NONE)
                .effectiveFrom(LocalDate.now(IST))
                .current(true)
                .commissionSlabs(List.of())
                .build();
    }

    private VendorCommercialTermsResponse toResponse(VendorCommercialTerms terms) {
        return VendorCommercialTermsResponse.builder()
                .id(terms.getId())
                .vendorId(terms.getVendorId())
                .feeModel(terms.getFeeModel())
                .commissionPercent(terms.getCommissionPercent())
                .perOrderFlatAmount(terms.getPerOrderFlatAmount())
                .monthlySubscriptionAmount(terms.getMonthlySubscriptionAmount())
                .subscriptionBillingDay(terms.getSubscriptionBillingDay())
                .commissionSlabs(readSlabs(terms.getCommissionSlabsJson()).stream()
                        .map(s -> VendorCommercialTermsResponse.CommissionSlab.builder()
                                .uptoAmount(s.uptoAmount())
                                .percent(s.percent())
                                .build())
                        .toList())
                .notes(terms.getNotes())
                .effectiveFrom(terms.getEffectiveFrom())
                .effectiveTo(terms.getEffectiveTo())
                .current(terms.getEffectiveTo() == null)
                .lastSubscriptionChargedYm(terms.getLastSubscriptionChargedYm())
                .updatedAt(terms.getUpdatedAt())
                .build();
    }

    private String writeSlabs(List<UpsertVendorCommercialTermsRequest.CommissionSlabRequest> slabs) {
        if (slabs == null || slabs.isEmpty()) {
            return null;
        }
        try {
            List<Slab> normalized = slabs.stream()
                    .map(s -> new Slab(s.getUptoAmount(), nz(s.getPercent())))
                    .sorted(Comparator.comparing(s -> s.uptoAmount() == null
                            ? new BigDecimal("999999999999")
                            : s.uptoAmount()))
                    .toList();
            return objectMapper.writeValueAsString(normalized);
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid commission slabs");
        }
    }

    private List<Slab> readSlabs(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<Slab>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private SlabPick pickSlab(BigDecimal gross, List<Slab> slabs) {
        if (slabs.isEmpty()) {
            return new SlabPick(BigDecimal.ZERO, "0% (no slabs)");
        }
        List<Slab> ordered = slabs.stream()
                .sorted(Comparator.comparing(s -> s.uptoAmount() == null
                        ? new BigDecimal("999999999999")
                        : s.uptoAmount()))
                .toList();
        for (Slab slab : ordered) {
            if (slab.uptoAmount() == null || gross.compareTo(slab.uptoAmount()) <= 0) {
                String label = slab.uptoAmount() == null
                        ? "above previous"
                        : "upto ₹" + slab.uptoAmount().toPlainString();
                return new SlabPick(nz(slab.percent()), label);
            }
        }
        Slab last = ordered.getLast();
        return new SlabPick(nz(last.percent()), "top slab");
    }

    private static BigDecimal percentOf(BigDecimal gross, BigDecimal percent) {
        return gross.multiply(nz(percent))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static int nzInt(Integer value) {
        return value == null ? 0 : value;
    }

    private static BigDecimal normalizeMoney(BigDecimal value, int scale) {
        return value == null ? null : value.setScale(scale, RoundingMode.HALF_UP);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static final UUID NULL_TERMS_ID = new UUID(0L, 0L);

    private static final class Bucket {
        private final VendorCommercialTerms terms;
        private BigDecimal gross = BigDecimal.ZERO;
        private int orderCount;

        private Bucket(VendorCommercialTerms terms) {
            this.terms = terms;
        }
    }

    private record DatedLine(BigDecimal amount, LocalDate date) {}

    private record FeePart(BigDecimal commission, List<String> lines, String slabLabel) {}

    private record Slab(BigDecimal uptoAmount, BigDecimal percent) {}

    private record SlabPick(BigDecimal percent, String label) {}
}
