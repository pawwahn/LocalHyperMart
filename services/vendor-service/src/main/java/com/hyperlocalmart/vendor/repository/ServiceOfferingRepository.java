package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.ServiceOffering;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ServiceOfferingRepository extends JpaRepository<ServiceOffering, UUID> {

    List<ServiceOffering> findAllByOrderBySortOrderAscNameAsc();

    boolean existsByNameIgnoreCase(String name);

    Optional<ServiceOffering> findByNameIgnoreCase(String name);
}
