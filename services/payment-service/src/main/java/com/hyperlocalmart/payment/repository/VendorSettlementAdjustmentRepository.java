package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.VendorSettlementAdjustment;
import com.hyperlocalmart.payment.entity.VendorSettlementAdjustmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorSettlementAdjustmentRepository extends JpaRepository<VendorSettlementAdjustment, UUID> {

    Optional<VendorSettlementAdjustment> findByClaimId(UUID claimId);

    List<VendorSettlementAdjustment> findByVendorIdAndTownIdAndStatusOrderByCreatedAtAsc(
            UUID vendorId, UUID townId, VendorSettlementAdjustmentStatus status);

    List<VendorSettlementAdjustment> findByVendorIdOrderByCreatedAtDesc(UUID vendorId);
}
