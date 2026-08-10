package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.VendorCommercialTerms;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorCommercialTermsRepository extends JpaRepository<VendorCommercialTerms, UUID> {

    List<VendorCommercialTerms> findByVendorIdOrderByEffectiveFromDesc(UUID vendorId);

    Optional<VendorCommercialTerms> findByVendorIdAndEffectiveToIsNull(UUID vendorId);

    List<VendorCommercialTerms> findByVendorIdAndEffectiveFromOrderByUpdatedAtDesc(
            UUID vendorId, LocalDate effectiveFrom);

    @Query("""
            select t from VendorCommercialTerms t
            where t.vendorId = :vendorId
              and t.effectiveFrom <= :onDate
              and (t.effectiveTo is null or t.effectiveTo >= :onDate)
            order by t.effectiveFrom desc
            """)
    List<VendorCommercialTerms> findCoveringDate(@Param("vendorId") UUID vendorId, @Param("onDate") LocalDate onDate);
}
