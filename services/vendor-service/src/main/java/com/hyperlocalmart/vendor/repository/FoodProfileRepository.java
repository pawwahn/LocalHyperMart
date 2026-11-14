package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.FoodProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FoodProfileRepository extends JpaRepository<FoodProfile, UUID> {

    List<FoodProfile> findByVendorIdIn(Collection<UUID> vendorIds);

    List<FoodProfile> findByVendorIdInAndEnabledTrue(Collection<UUID> vendorIds);
}