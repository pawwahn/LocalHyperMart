package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.LaundryOrderLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface LaundryOrderLineRepository extends JpaRepository<LaundryOrderLine, UUID> {

    boolean existsByPhotoMediaId(UUID photoMediaId);

    @Query("""
            select l from LaundryOrderLine l
            join fetch l.order o
            where l.photoMediaId is not null
              and l.photoDeletedAt is null
              and o.complaintOpen = false
              and o.deliveredAt is not null
              and o.deliveredAt < :cutoff
            """)
    List<LaundryOrderLine> findPhotosDue(@Param("cutoff") Instant cutoff);
}
