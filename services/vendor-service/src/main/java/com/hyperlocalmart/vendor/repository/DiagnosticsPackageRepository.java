package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.DiagnosticsPackage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiagnosticsPackageRepository extends JpaRepository<DiagnosticsPackage, UUID> {

    List<DiagnosticsPackage> findByVendorIdOrderBySortOrderAscNameAsc(UUID vendorId);

    List<DiagnosticsPackage> findByVendorIdIn(List<UUID> vendorIds);

    Optional<DiagnosticsPackage> findByIdAndVendorId(UUID id, UUID vendorId);

    Optional<DiagnosticsPackage> findFirstByVendorIdAndCodeIgnoreCaseOrderBySortOrderAscNameAsc(UUID vendorId, String code);

    List<DiagnosticsPackage> findByVendorIdAndCodeIgnoreCase(UUID vendorId, String code);
}
