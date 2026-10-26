package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.BeautyRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BeautyRateRepository extends JpaRepository<BeautyRate, UUID> {

    List<BeautyRate> findByVendorIdIn(Collection<UUID> vendorIds);

    List<BeautyRate> findByVendorIdOrderByServiceTypeAsc(UUID vendorId);
}
