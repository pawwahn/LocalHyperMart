package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.TownConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TownConfigRepository extends JpaRepository<TownConfig, UUID> {

    Optional<TownConfig> findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(
            UUID townId, String configKey);
}
