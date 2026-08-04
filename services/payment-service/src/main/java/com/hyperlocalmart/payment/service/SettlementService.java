package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.OrderClient.SettlementCandidateItem;
import com.hyperlocalmart.payment.dto.request.CreateSettlementRequest;
import com.hyperlocalmart.payment.dto.request.MarkSettlementPaidRequest;
import com.hyperlocalmart.payment.dto.response.SettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.dto.response.VendorOrderPayoutResponse;
import com.hyperlocalmart.payment.entity.*;
import com.hyperlocalmart.payment.repository.SettlementLineItemRepository;
import com.hyperlocalmart.payment.repository.SettlementRepository;
import com.hyperlocalmart.payment.repository.VendorSettlementAdjustmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SettlementService {

    private static final List<SettlementStatus> BLOCKING_STATUSES =
            List.of(SettlementStatus.DRAFT, SettlementStatus.FINALIZED, SettlementStatus.PAID);

    private final SettlementRepository settlementRepository;
    private final SettlementLineItemRepository settlementLineItemRepository;
    private final VendorSettlementAdjustmentRepository vendorSettlementAdjustmentRepository;
    private final OrderClient orderClient;

    @Transactional(readOnly = true)
    public SettlementCandidateView listCandidates(UUID townId, UUID vendorId, LocalDate from, LocalDate to) {
        var candidates = orderClient.getSettlementCandidates(vendorId, townId, from, to);
        List<UUID> ids = candidates.items() == null ? List.of()
                : candidates.items().stream().map(SettlementCandidateItem::subOrderId).toList();
        Set<UUID> settled = ids.isEmpty() ? Set.of()
                : new HashSet<>(settlementLineItemRepository.findSettledSubOrderIds(ids, BLOCKING_STATUSES));

        List<SettlementCandidateView.Item> items = candidates.items() == null ? List.of()
                : candidates.items().stream()
                .map(item -> SettlementCandidateView.Item.builder()
                        .subOrderId(item.subOrderId())
                        .orderId(item.orderId())
                        .orderNumber(item.orderNumber())
                        .subOrderNumber(item.subOrderNumber())
                        .placedAt(item.placedAt())
                        .status(item.status())
                        .paymentStatus(item.paymentStatus())
                        .subtotal(item.subtotal())
                        .alreadySettled(settled.contains(item.subOrderId()))
                        .build())
                .toList();

        List<VendorSettlementAdjustment> pendingAdjustments =
                vendorSettlementAdjustmentRepository.findByVendorIdAndTownIdAndStatusOrderByCreatedAtAsc(
                        vendorId, townId, VendorSettlementAdjustmentStatus.PENDING);
        BigDecimal pendingClaimChargebacks = pendingAdjustments.stream()
                .map(VendorSettlementAdjustment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<SettlementCandidateView.PendingClaim> pendingClaims = pendingAdjustments.stream()
                .map(adj -> SettlementCandidateView.PendingClaim.builder()
                        .claimId(adj.getClaimId())
                        .orderNumber(adj.getOrderNumber())
                        .amount(adj.getAmount())
                        .reason(adj.getReason())
                        .build())
                .toList();

        return SettlementCandidateView.builder()
                .vendorId(vendorId)
                .townId(townId)
                .from(from.toString())
                .to(to.toString())
                .pendingClaimChargebacks(pendingClaimChargebacks)
                .pendingClaimCount(pendingAdjustments.size())
                .pendingClaims(pendingClaims)
                .items(items)
                .build();
    }

    @Transactional
    public SettlementResponse create(UUID actorId, CreateSettlementRequest request) {
        if (request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "periodEnd must be on or after periodStart");
        }
        List<UUID> requestedIds = request.getSubOrderIds().stream().distinct().toList();
        List<SettlementCandidateItem> resolved =
                orderClient.resolveSettlementSubOrders(request.getVendorId(), requestedIds);
        if (resolved.size() != requestedIds.size()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "One or more sub-orders were not found for this vendor or are rejected");
        }

        Set<UUID> already = new HashSet<>(
                settlementLineItemRepository.findSettledSubOrderIds(requestedIds, BLOCKING_STATUSES));
        if (!already.isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Some orders are already included in a settlement: " + already.size());
        }

        BigDecimal gross = resolved.stream()
                .map(SettlementCandidateItem::subtotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal commission = request.getCommissionAmount() == null
                ? BigDecimal.ZERO : request.getCommissionAmount();
        if (commission.compareTo(BigDecimal.ZERO) < 0 || commission.compareTo(gross) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid commission amount");
        }

        List<VendorSettlementAdjustment> pendingAdjustments =
                vendorSettlementAdjustmentRepository.findByVendorIdAndTownIdAndStatusOrderByCreatedAtAsc(
                        request.getVendorId(), request.getTownId(), VendorSettlementAdjustmentStatus.PENDING);
        BigDecimal claimChargebacks = pendingAdjustments.stream()
                .map(VendorSettlementAdjustment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal net = gross.subtract(commission).subtract(claimChargebacks);
        if (net.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Claim chargebacks (₹" + claimChargebacks.toPlainString()
                            + ") exceed payout after commission. Include more orders or lower commission.");
        }

        Settlement settlement = Settlement.builder()
                .townId(request.getTownId())
                .payeeType(SettlementPayeeType.VENDOR)
                .payeeId(request.getVendorId())
                .payeeName(request.getVendorName())
                .periodStart(request.getPeriodStart())
                .periodEnd(request.getPeriodEnd())
                .periodType(request.getPeriodType() == null
                        ? SettlementPeriodType.CUSTOM : request.getPeriodType())
                .grossAmount(gross)
                .commissionAmount(commission)
                .netAmount(net)
                .status(SettlementStatus.DRAFT)
                .build();
        settlement.setCreatedBy(actorId);
        settlement.setUpdatedBy(actorId);

        for (SettlementCandidateItem item : resolved) {
            SettlementLineItem line = SettlementLineItem.builder()
                    .settlement(settlement)
                    .orderId(item.orderId())
                    .subOrderId(item.subOrderId())
                    .orderNumber(item.orderNumber())
                    .subOrderNumber(item.subOrderNumber())
                    .lineType("ORDER")
                    .amount(item.subtotal())
                    .description("Vendor sub-order payout")
                    .build();
            line.setCreatedBy(actorId);
            line.setUpdatedBy(actorId);
            settlement.getLineItems().add(line);
        }

        for (VendorSettlementAdjustment adj : pendingAdjustments) {
            SettlementLineItem line = SettlementLineItem.builder()
                    .settlement(settlement)
                    .orderId(adj.getOrderId())
                    .subOrderId(adj.getSubOrderId())
                    .orderNumber(null)
                    .subOrderNumber(null)
                    .lineType("ADJUSTMENT")
                    .amount(adj.getAmount().negate())
                    .description(adj.getReason() != null && !adj.getReason().isBlank()
                            ? adj.getReason()
                            : "Claim chargeback — buyer credited")
                    .build();
            line.setCreatedBy(actorId);
            line.setUpdatedBy(actorId);
            settlement.getLineItems().add(line);
        }

        if (request.isMarkPaid()) {
            applyPaid(settlement, actorId, request.getPayoutMethod(), request.getTransactionReference(),
                    request.getTransactionNotes(), request.getPaidAt());
        }

        Settlement saved = settlementRepository.save(settlement);
        for (VendorSettlementAdjustment adj : pendingAdjustments) {
            adj.setStatus(VendorSettlementAdjustmentStatus.APPLIED);
            adj.setAppliedSettlementId(saved.getId());
            adj.setUpdatedAt(java.time.Instant.now());
        }
        if (!pendingAdjustments.isEmpty()) {
            vendorSettlementAdjustmentRepository.saveAll(pendingAdjustments);
        }
        return toResponse(saved);
    }

    @Transactional
    public SettlementResponse markPaid(UUID actorId, UUID settlementId, MarkSettlementPaidRequest request) {
        Settlement settlement = settlementRepository.findDetailedById(settlementId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Settlement not found"));
        if (settlement.getStatus() == SettlementStatus.PAID) {
            throw new BusinessException(ErrorCode.CONFLICT, "Settlement is already paid");
        }
        applyPaid(settlement, actorId, request.getPayoutMethod(), request.getTransactionReference(),
                request.getTransactionNotes(), request.getPaidAt());
        settlement.setUpdatedBy(actorId);
        return toResponse(settlementRepository.save(settlement));
    }

    @Transactional(readOnly = true)
    public List<SettlementResponse> list(
            UUID townId,
            SettlementPayeeType payeeType,
            UUID payeeId,
            SettlementStatus status) {
        return settlementRepository.findFiltered(townId, payeeType, payeeId, status).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SettlementResponse get(UUID settlementId) {
        Settlement settlement = settlementRepository.findDetailedById(settlementId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Settlement not found"));
        return toResponse(settlement);
    }

    @Transactional(readOnly = true)
    public SettlementResponse getForVendor(UUID vendorId, UUID settlementId) {
        SettlementResponse response = get(settlementId);
        if (response.getPayeeType() != SettlementPayeeType.VENDOR
                || !response.getPayeeId().equals(vendorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Settlement does not belong to vendor");
        }
        return response;
    }

    @Transactional(readOnly = true)
    public VendorOrderPayoutResponse lookupVendorPayouts(UUID vendorId, List<UUID> subOrderIds) {
        List<UUID> ids = subOrderIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return VendorOrderPayoutResponse.builder().items(List.of()).build();
        }
        List<SettlementLineItem> lines =
                settlementLineItemRepository.findByVendorAndSubOrderIds(vendorId, ids);
        Map<UUID, SettlementLineItem> bySubOrder = lines.stream()
                .collect(Collectors.toMap(SettlementLineItem::getSubOrderId, Function.identity(), (a, b) -> a));

        List<VendorOrderPayoutResponse.Item> items = ids.stream().map(id -> {
            SettlementLineItem line = bySubOrder.get(id);
            if (line == null) {
                return VendorOrderPayoutResponse.Item.builder()
                        .subOrderId(id)
                        .paid(false)
                        .build();
            }
            Settlement s = line.getSettlement();
            boolean paid = s.getStatus() == SettlementStatus.PAID;
            return VendorOrderPayoutResponse.Item.builder()
                    .subOrderId(line.getSubOrderId())
                    .orderId(line.getOrderId())
                    .orderNumber(line.getOrderNumber())
                    .subOrderNumber(line.getSubOrderNumber())
                    .amount(line.getAmount())
                    .paid(paid)
                    .settlementStatus(s.getStatus())
                    .settlementId(s.getId())
                    .paidAt(s.getPaidAt())
                    .payoutMethod(s.getPayoutMethod())
                    .transactionReference(s.getTransactionReference())
                    .transactionNotes(s.getTransactionNotes())
                    .periodStart(s.getPeriodStart() == null ? null : s.getPeriodStart().toString())
                    .periodEnd(s.getPeriodEnd() == null ? null : s.getPeriodEnd().toString())
                    .build();
        }).toList();

        return VendorOrderPayoutResponse.builder().items(items).build();
    }

    private void applyPaid(
            Settlement settlement,
            UUID actorId,
            String payoutMethod,
            String transactionReference,
            String transactionNotes,
            Instant paidAt) {
        if (payoutMethod == null || payoutMethod.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "payoutMethod is required when marking paid");
        }
        settlement.setStatus(SettlementStatus.PAID);
        settlement.setPayoutMethod(payoutMethod.trim().toUpperCase(Locale.ROOT));
        settlement.setTransactionReference(transactionReference);
        settlement.setTransactionNotes(transactionNotes);
        settlement.setPaidAt(paidAt == null ? Instant.now() : paidAt);
        settlement.setPaidBy(actorId);
    }

    private SettlementResponse toResponse(Settlement settlement) {
        List<SettlementResponse.Line> lines = settlement.getLineItems() == null ? List.of()
                : settlement.getLineItems().stream()
                .sorted(Comparator.comparing(SettlementLineItem::getSubOrderNumber,
                        Comparator.nullsLast(String::compareTo)))
                .map(line -> SettlementResponse.Line.builder()
                        .id(line.getId())
                        .orderId(line.getOrderId())
                        .subOrderId(line.getSubOrderId())
                        .orderNumber(line.getOrderNumber())
                        .subOrderNumber(line.getSubOrderNumber())
                        .lineType(line.getLineType())
                        .amount(line.getAmount())
                        .description(line.getDescription())
                        .build())
                .toList();

        BigDecimal commission = settlement.getCommissionAmount() == null
                ? BigDecimal.ZERO : settlement.getCommissionAmount();
        BigDecimal gross = settlement.getGrossAmount() == null
                ? BigDecimal.ZERO : settlement.getGrossAmount();
        BigDecimal net = settlement.getNetAmount() == null
                ? BigDecimal.ZERO : settlement.getNetAmount();
        BigDecimal claimFromLines = lines.stream()
                .filter(line -> "ADJUSTMENT".equalsIgnoreCase(line.getLineType()))
                .map(SettlementResponse.Line::getAmount)
                .filter(Objects::nonNull)
                .map(BigDecimal::abs)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal claimChargebacks = claimFromLines.compareTo(BigDecimal.ZERO) > 0
                ? claimFromLines
                : gross.subtract(commission).subtract(net).max(BigDecimal.ZERO);

        return SettlementResponse.builder()
                .id(settlement.getId())
                .townId(settlement.getTownId())
                .payeeType(settlement.getPayeeType())
                .payeeId(settlement.getPayeeId())
                .payeeName(settlement.getPayeeName())
                .periodStart(settlement.getPeriodStart())
                .periodEnd(settlement.getPeriodEnd())
                .periodType(settlement.getPeriodType())
                .grossAmount(settlement.getGrossAmount())
                .commissionAmount(settlement.getCommissionAmount())
                .claimChargebacksAmount(claimChargebacks)
                .netAmount(settlement.getNetAmount())
                .status(settlement.getStatus())
                .payoutMethod(settlement.getPayoutMethod())
                .transactionReference(settlement.getTransactionReference())
                .transactionNotes(settlement.getTransactionNotes())
                .paidAt(settlement.getPaidAt())
                .paidBy(settlement.getPaidBy())
                .createdAt(settlement.getCreatedAt())
                .lines(lines)
                .build();
    }
}
