package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.DiagnosticsBranch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiagnosticsBranchRepository extends JpaRepository<DiagnosticsBranch, UUID> {

    List<DiagnosticsBranch> findByVendorIdOrderBySortOrderAscLabelAsc(UUID vendorId);

    List<DiagnosticsBranch> findByVendorIdIn(Collection<UUID> vendorIds);

    Optional<DiagnosticsBranch> findByIdAndVendorId(UUID id, UUID vendorId);
}
