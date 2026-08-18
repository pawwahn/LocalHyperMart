package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.TownAd;
import com.hyperlocalmart.town.entity.TownAdSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TownAdRepository extends JpaRepository<TownAd, UUID> {

    List<TownAd> findByTownIdOrderBySlotAscSlotIndexAsc(UUID townId);

    List<TownAd> findByTownIdAndEnabledTrueOrderBySlotAscSlotIndexAsc(UUID townId);

    Optional<TownAd> findByTownIdAndSlotAndSlotIndex(UUID townId, TownAdSlot slot, int slotIndex);

    List<TownAd> findByAllTownsTrueAndEnabledTrueOrderByUpdatedAtDesc();

    List<TownAd> findByCampaignIdAndSlotAndSlotIndex(UUID campaignId, TownAdSlot slot, int slotIndex);
}
