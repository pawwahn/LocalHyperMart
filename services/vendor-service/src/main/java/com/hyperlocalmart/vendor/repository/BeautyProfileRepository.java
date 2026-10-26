package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.BeautyProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BeautyProfileRepository extends JpaRepository<BeautyProfile, UUID> {

    List<BeautyProfile> findByVendorIdIn(Collection<UUID> vendorIds);
}
