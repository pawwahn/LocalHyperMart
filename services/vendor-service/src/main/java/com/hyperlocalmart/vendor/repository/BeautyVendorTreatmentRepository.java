package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.BeautyVendorTreatment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BeautyVendorTreatmentRepository extends JpaRepository<BeautyVendorTreatment, BeautyVendorTreatment.Key> {

    List<BeautyVendorTreatment> findByVendorIdOrderByServiceCodeAsc(UUID vendorId);

    List<BeautyVendorTreatment> findByVendorIdIn(Collection<UUID> vendorIds);

    void deleteByVendorIdAndServiceCode(UUID vendorId, String serviceCode);
}
