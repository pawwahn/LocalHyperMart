package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.TownAd;
import com.hyperlocalmart.town.entity.TownAdSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TownAdRepository extends JpaRepository<TownAd, UUID> {

    List<TownAd> findByTownIdOrderBySlotAsc(UUID townId);

    List<TownAd> findByTownIdAndEnabledTrueOrderBySlotAsc(UUID townId);

    Optional<TownAd> findByTownIdAndSlot(UUID townId, TownAdSlot slot);
}
