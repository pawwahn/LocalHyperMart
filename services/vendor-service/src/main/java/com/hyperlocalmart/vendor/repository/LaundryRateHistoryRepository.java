package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.LaundryRateHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LaundryRateHistoryRepository extends JpaRepository<LaundryRateHistory, UUID> {

    List<LaundryRateHistory> findTop30ByVendorIdOrderByCreatedAtDesc(UUID vendorId);
}
