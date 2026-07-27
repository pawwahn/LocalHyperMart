package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.entity.VendorStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorRepository extends JpaRepository<Vendor, UUID> {

    Optional<Vendor> findByUserId(UUID userId);

    boolean existsByPhone(String phone);

    List<Vendor> findByTownIdOrderByCreatedAtDesc(UUID townId);

    List<Vendor> findByTownIdAndStatusOrderByCreatedAtDesc(UUID townId, VendorStatus status);
}
