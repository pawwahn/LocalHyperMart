package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.Unit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UnitRepository extends JpaRepository<Unit, UUID> {
}
