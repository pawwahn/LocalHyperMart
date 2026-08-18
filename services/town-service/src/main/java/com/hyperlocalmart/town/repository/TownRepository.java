package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.Town;
import com.hyperlocalmart.town.entity.TownStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TownRepository extends JpaRepository<Town, UUID> {

    List<Town> findByStatusOrderByDisplayNameAsc(TownStatus status);

    Page<Town> findByStatusOrderByDisplayNameAsc(TownStatus status, Pageable pageable);

    List<Town> findAllByOrderByDisplayNameAsc();

    Page<Town> findAllByOrderByDisplayNameAsc(Pageable pageable);

    List<Town> findByIdIn(Collection<UUID> ids);

    @Query("""
            SELECT t FROM Town t
            WHERE (:status IS NULL OR t.status = :status)
              AND (
                    :q IS NULL
                    OR LOWER(t.displayName) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(t.name) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(t.townCode) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(t.state) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(t.stateCode) LIKE LOWER(CONCAT('%', :q, '%'))
                  )
            """)
    Page<Town> search(
            @Param("status") TownStatus status,
            @Param("q") String q,
            Pageable pageable);

    boolean existsByTownCodeIgnoreCaseAndStateCodeIgnoreCaseAndCountryCodeIgnoreCase(
            String townCode, String stateCode, String countryCode);

    boolean existsByNameIgnoreCaseAndStateIgnoreCaseAndCountryCodeIgnoreCase(
            String name, String state, String countryCode);
}
