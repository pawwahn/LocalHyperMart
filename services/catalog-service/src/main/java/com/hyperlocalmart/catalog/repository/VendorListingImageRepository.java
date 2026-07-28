package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.VendorListingImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface VendorListingImageRepository extends JpaRepository<VendorListingImage, UUID> {

    List<VendorListingImage> findByListingIdOrderBySortOrderAsc(UUID listingId);

    List<VendorListingImage> findByListingIdInOrderByListingIdAscSortOrderAsc(Collection<UUID> listingIds);

    void deleteByListingId(UUID listingId);
}
