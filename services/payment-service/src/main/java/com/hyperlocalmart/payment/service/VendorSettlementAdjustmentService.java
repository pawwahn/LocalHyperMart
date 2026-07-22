package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.CreateVendorSettlementAdjustmentRequest;
import com.hyperlocalmart.payment.dto.response.VendorSettlementAdjustmentResponse;
import com.hyperlocalmart.payment.entity.VendorSettlementAdjustment;
import com.hyperlocalmart.payment.entity.VendorSettlementAdjustmentStatus;
import com.hyperlocalmart.payment.repository.VendorSettlementAdjustmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorSettlementAdjustmentService {

    private final VendorSettlementAdjustmentRepository repository;

    /**
     * Idempotent on claimId — re-posting the same claim credit is a no-op.
     */
    @Transactional
    public VendorSettlementAdjustmentResponse recordClaimChargeback(CreateVendorSettlementAdjustmentRequest request) {
        return repository.findByClaimId(request.getClaimId())
                .map(this::toResponse)
                .orElseGet(() -> {
                    VendorSettlementAdjustment adj = VendorSettlementAdjustment.builder()
                            .townId(request.getTownId())
                            .vendorId(request.getVendorId())
                            .shopId(request.getShopId())
                            .claimId(request.getClaimId())
                            .orderId(request.getOrderId())
                            .orderNumber(request.getOrderNumber())
                            .orderItemId(request.getOrderItemId())
                            .subOrderId(request.getSubOrderId())
                            .amount(request.getAmount())
                            .reason(request.getReason())
                            .status(VendorSettlementAdjustmentStatus.PENDING)
                            .build();
                    return toResponse(repository.save(adj));
                });
    }

    @Transactional(readOnly = true)
    public List<VendorSettlementAdjustment> listPending(UUID vendorId, UUID townId) {
        return repository.findByVendorIdAndTownIdAndStatusOrderByCreatedAtAsc(
                vendorId, townId, VendorSettlementAdjustmentStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public List<VendorSettlementAdjustmentResponse> listForVendor(UUID vendorId) {
        return repository.findByVendorIdOrderByCreatedAtDesc(vendorId).stream()
                .map(this::toResponse)
                .toList();
    }

    private VendorSettlementAdjustmentResponse toResponse(VendorSettlementAdjustment adj) {
        return VendorSettlementAdjustmentResponse.builder()
                .id(adj.getId())
                .townId(adj.getTownId())
                .vendorId(adj.getVendorId())
                .shopId(adj.getShopId())
                .claimId(adj.getClaimId())
                .orderId(adj.getOrderId())
                .orderNumber(adj.getOrderNumber())
                .orderItemId(adj.getOrderItemId())
                .subOrderId(adj.getSubOrderId())
                .amount(adj.getAmount())
                .reason(adj.getReason())
                .status(adj.getStatus())
                .appliedSettlementId(adj.getAppliedSettlementId())
                .createdAt(adj.getCreatedAt())
                .build();
    }
}
