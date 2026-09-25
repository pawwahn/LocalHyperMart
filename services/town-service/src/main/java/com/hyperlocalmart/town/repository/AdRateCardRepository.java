package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.AdRateCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AdRateCardRepository extends JpaRepository<AdRateCard, UUID> {
}
