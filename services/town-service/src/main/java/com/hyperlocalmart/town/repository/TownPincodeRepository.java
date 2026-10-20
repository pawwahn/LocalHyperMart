package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.TownPincode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TownPincodeRepository extends JpaRepository<TownPincode, UUID> {

    List<TownPincode> findByTownIdOrderByPincodeAsc(UUID townId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from TownPincode p where p.town.id = :townId")
    void deleteByTownId(@Param("townId") UUID townId);
}
