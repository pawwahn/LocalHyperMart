package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.Town;
import com.hyperlocalmart.town.entity.TownStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TownRepository extends JpaRepository<Town, UUID> {

    List<Town> findByStatusOrderByDisplayNameAsc(TownStatus status);

    List<Town> findAllByOrderByDisplayNameAsc();

    boolean existsByTownCodeIgnoreCaseAndStateCodeIgnoreCaseAndCountryCodeIgnoreCase(
            String townCode, String stateCode, String countryCode);

    boolean existsByNameIgnoreCaseAndStateIgnoreCaseAndCountryCodeIgnoreCase(
            String name, String state, String countryCode);
}
