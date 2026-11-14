package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.DiagnosticsStaff;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiagnosticsStaffRepository extends JpaRepository<DiagnosticsStaff, UUID> {

    List<DiagnosticsStaff> findByVendorIdOrderByDisplayNameAsc(UUID vendorId);

    Optional<DiagnosticsStaff> findByUserId(UUID userId);

    Optional<DiagnosticsStaff> findByVendorIdAndPhone(UUID vendorId, String phone);

    Optional<DiagnosticsStaff> findByIdAndVendorId(UUID id, UUID vendorId);

    long countByVendorIdAndTitleAndActiveTrue(UUID vendorId, String title);
}
