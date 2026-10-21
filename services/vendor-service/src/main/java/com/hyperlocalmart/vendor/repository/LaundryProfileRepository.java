package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.LaundryProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface LaundryProfileRepository extends JpaRepository<LaundryProfile, UUID> {

    List<LaundryProfile> findByVendorIdIn(Collection<UUID> vendorIds);

    List<LaundryProfile> findByEnabledTrue();
}
