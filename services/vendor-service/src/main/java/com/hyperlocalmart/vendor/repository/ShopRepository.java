package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.Shop;
import com.hyperlocalmart.vendor.entity.ShopStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ShopRepository extends JpaRepository<Shop, UUID> {

    List<Shop> findByIdInAndStatus(Collection<UUID> ids, ShopStatus status);

    List<Shop> findByIdInAndStatusAndAcceptingOrdersTrue(Collection<UUID> ids, ShopStatus status);

    List<Shop> findByVendorIdAndStatus(UUID vendorId, ShopStatus status);

    List<Shop> findByVendorIdOrderByCreatedAtAsc(UUID vendorId);
}
