package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.entity.*;
import com.hyperlocalmart.catalog.repository.MasterItemImageRepository;
import com.hyperlocalmart.catalog.repository.VendorListingImageRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.api.PageResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogBrowseServiceTest {

    @Mock private VendorListingRepository vendorListingRepository;
    @Mock private MasterItemImageRepository masterItemImageRepository;
    @Mock private VendorListingImageRepository vendorListingImageRepository;
    @Mock private VendorShopClient vendorShopClient;

    @InjectMocks
    private CatalogBrowseService catalogBrowseService;

    @Test
    void browse_returnsItemsWithShopNames() {
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");
        UUID shopId = UUID.fromString("c1111111-1111-4111-8111-111111111111");
        VendorListing listing = sampleListing(shopId);
        when(vendorListingRepository.browseActive(eq(townId), isNull(), isNull(), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(listing)));
        when(vendorShopClient.getShopsByIds(anyList())).thenReturn(Map.of(
                shopId, new VendorShopClient.ShopInfo(shopId, listing.getVendorId(), "Ravi Kirana")
        ));
        when(vendorListingImageRepository.findByListingIdInOrderByListingIdAscSortOrderAsc(any()))
                .thenReturn(List.of());
        when(masterItemImageRepository.findByMasterItemIdInOrderByMasterItemIdAscSortOrderAsc(any()))
                .thenReturn(List.of());

        PageResponse<CatalogItemResponse> response = catalogBrowseService.browse(townId, null, null, 0, 24, "name", "asc");

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getName()).isEqualTo("Tomato");
        assertThat(response.getItems().getFirst().getShopName()).isEqualTo("Ravi Kirana");
        assertThat(response.getItems().getFirst().getUnit()).isEqualTo("KG");
    }

    private VendorListing sampleListing(UUID shopId) {
        Unit unit = Unit.builder().code("KG").label("Kilogram").status(CatalogItemStatus.ACTIVE).build();
        Category category = Category.builder()
                .id(UUID.fromString("c1111111-1111-4111-8111-111111111112"))
                .name("Vegetables")
                .status(CatalogItemStatus.ACTIVE)
                .build();
        MasterItem masterItem = MasterItem.builder()
                .id(UUID.fromString("f1111111-1111-4111-8111-111111111111"))
                .name("Tomato")
                .category(category)
                .unit(unit)
                .status(CatalogItemStatus.ACTIVE)
                .build();
        return VendorListing.builder()
                .id(UUID.randomUUID())
                .townId(UUID.fromString("a1111111-1111-4111-8111-111111111111"))
                .vendorId(UUID.fromString("b1111111-1111-4111-8111-111111111111"))
                .shopId(shopId)
                .masterItem(masterItem)
                .price(new BigDecimal("30.00"))
                .discountPrice(new BigDecimal("28.00"))
                .active(true)
                .build();
    }
}
