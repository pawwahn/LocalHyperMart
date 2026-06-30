package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.TownPincode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TownPincodeRepository extends JpaRepository<TownPincode, UUID> {

    List<TownPincode> findByTownIdOrderByPincodeAsc(UUID townId);
}
