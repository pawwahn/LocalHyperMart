package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.DiagnosticsTest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiagnosticsTestRepository extends JpaRepository<DiagnosticsTest, UUID> {

    List<DiagnosticsTest> findByVendorIdOrderBySortOrderAscNameAsc(UUID vendorId);

    List<DiagnosticsTest> findByVendorIdIn(Collection<UUID> vendorIds);

    Optional<DiagnosticsTest> findByIdAndVendorId(UUID id, UUID vendorId);

    Optional<DiagnosticsTest> findFirstByVendorIdAndCodeIgnoreCaseOrderBySortOrderAscNameAsc(UUID vendorId, String code);

    List<DiagnosticsTest> findByVendorIdAndCodeIgnoreCase(UUID vendorId, String code);
}
