package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.request.CreateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.response.VendorListingResponse;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.MasterItem;
import com.hyperlocalmart.catalog.entity.Unit;
import com.hyperlocalmart.catalog.repository.CategoryRepository;
import com.hyperlocalmart.catalog.repository.MasterItemRepository;
import com.hyperlocalmart.catalog.repository.UnitRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VendorListingServiceTest {

    @Mock private VendorListingRepository vendorListingRepository;
    @Mock private MasterItemRepository masterItemRepository;
    @Mock private com.hyperlocalmart.catalog.repository.MasterItemImageRepository masterItemImageRepository;
    @Mock private com.hyperlocalmart.catalog.repository.VendorListingImageRepository vendorListingImageRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private UnitRepository unitRepository;
    @Mock private VendorShopClient vendorShopClient;

    @InjectMocks
    private VendorListingService vendorListingService;

    @Test
    void createListing_savesActiveListing() {
        UUID vendorId = UUID.fromString("b1111111-1111-4111-8111-111111111111");
        UUID masterItemId = UUID.fromString("f3333333-3333-4333-8333-333333333333");
        UUID actorId = UUID.randomUUID();

        CreateVendorListingRequest request = new CreateVendorListingRequest();
        request.setMasterItemId(masterItemId);
        request.setPrice(new BigDecimal("45.00"));
        request.setActive(true);

        when(vendorShopClient.getShopContextForVendor(vendorId)).thenReturn(
                new VendorShopClient.VendorShopContext(
                        vendorId,
                        UUID.fromString("a1111111-1111-4111-8111-111111111111"),
                        UUID.fromString("c1111111-1111-4111-8111-111111111111"),
                        "Ravi Kirana"));
        when(masterItemRepository.findByIdAndStatus(masterItemId, CatalogItemStatus.ACTIVE))
                .thenReturn(Optional.of(MasterItem.builder()
                        .id(masterItemId)
                        .name("Rice")
                        .unit(Unit.builder().code("KG").label("Kilogram").build())
                        .status(CatalogItemStatus.ACTIVE)
                        .build()));
        when(vendorListingRepository.findByVendorIdAndMasterItemId(vendorId, masterItemId))
                .thenReturn(Optional.empty());
        when(vendorListingRepository.save(any())).thenAnswer(invocation -> {
            com.hyperlocalmart.catalog.entity.VendorListing listing = invocation.getArgument(0);
            listing.setId(UUID.randomUUID());
            return listing;
        });
        when(vendorListingImageRepository.findByListingIdInOrderByListingIdAscSortOrderAsc(any()))
                .thenReturn(java.util.List.of());
        when(masterItemImageRepository.findByMasterItemIdInOrderByMasterItemIdAscSortOrderAsc(any()))
                .thenReturn(java.util.List.of());

        VendorListingResponse response = vendorListingService.createListing(vendorId, actorId, request);

        assertThat(response.getPrice()).isEqualByComparingTo("45.00");
        assertThat(response.isActive()).isTrue();
        assertThat(response.getName()).isEqualTo("Rice");
    }
}
