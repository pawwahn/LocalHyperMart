package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.DiagnosticsProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DiagnosticsProfileRepository extends JpaRepository<DiagnosticsProfile, UUID> {

    List<DiagnosticsProfile> findByVendorIdIn(Collection<UUID> vendorIds);
}
