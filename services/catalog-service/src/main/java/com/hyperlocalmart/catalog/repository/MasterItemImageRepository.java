package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.MasterItemImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MasterItemImageRepository extends JpaRepository<MasterItemImage, UUID> {

    List<MasterItemImage> findByMasterItemIdOrderBySortOrderAsc(UUID masterItemId);

    List<MasterItemImage> findByMasterItemIdInOrderByMasterItemIdAscSortOrderAsc(Collection<UUID> masterItemIds);

    void deleteByMasterItemId(UUID masterItemId);
}
