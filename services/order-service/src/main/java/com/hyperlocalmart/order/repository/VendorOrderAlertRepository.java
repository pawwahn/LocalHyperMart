package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.VendorOrderAlert;
import com.hyperlocalmart.order.entity.VendorOrderAlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorOrderAlertRepository extends JpaRepository<VendorOrderAlert, UUID> {

    boolean existsByVendorSubOrderIdAndStatus(UUID vendorSubOrderId, VendorOrderAlertStatus status);

    List<VendorOrderAlert> findByVendorIdAndStatusOrderByCreatedAtDesc(
            UUID vendorId, VendorOrderAlertStatus status);

    Optional<VendorOrderAlert> findByIdAndVendorId(UUID id, UUID vendorId);

    List<VendorOrderAlert> findByVendorSubOrderIdInOrderByCreatedAtDesc(Collection<UUID> vendorSubOrderIds);
}
