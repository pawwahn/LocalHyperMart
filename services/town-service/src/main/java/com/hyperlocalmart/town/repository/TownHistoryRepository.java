package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.TownHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

public interface TownHistoryRepository extends JpaRepository<TownHistory, UUID>, JpaSpecificationExecutor<TownHistory> {
}
