package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.DiagnosticsStaffAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DiagnosticsStaffAuditRepository extends JpaRepository<DiagnosticsStaffAudit, UUID> {

    List<DiagnosticsStaffAudit> findByVendorIdOrderByCreatedAtDesc(UUID vendorId);
}
