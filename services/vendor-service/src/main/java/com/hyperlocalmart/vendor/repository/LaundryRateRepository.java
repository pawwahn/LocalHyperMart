package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.LaundryRate;
import com.hyperlocalmart.vendor.laundry.LaundryItemType;
import com.hyperlocalmart.vendor.laundry.LaundryServiceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LaundryRateRepository extends JpaRepository<LaundryRate, UUID> {

    List<LaundryRate> findByVendorIdOrderByServiceTypeAscItemTypeAsc(UUID vendorId);

    List<LaundryRate> findByVendorIdIn(Collection<UUID> vendorIds);

    Optional<LaundryRate> findByVendorIdAndServiceTypeAndItemType(
            UUID vendorId, LaundryServiceType serviceType, LaundryItemType itemType);
}
