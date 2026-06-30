package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.vendor.dto.response.ShopSummaryResponse;
import com.hyperlocalmart.vendor.entity.Shop;
import com.hyperlocalmart.vendor.entity.ShopStatus;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.repository.ShopRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopServiceTest {

    @Mock private ShopRepository shopRepository;

    @InjectMocks
    private ShopService shopService;

    @Test
    void getShopsByIds_returnsSummaries() {
        UUID shopId = UUID.fromString("c1111111-1111-4111-8111-111111111111");
        UUID vendorId = UUID.fromString("b1111111-1111-4111-8111-111111111111");
        Vendor vendor = Vendor.builder().id(vendorId).build();
        Shop shop = Shop.builder().id(shopId).vendor(vendor).shopName("Ravi Kirana").status(ShopStatus.ACTIVE).build();
        when(shopRepository.findByIdInAndStatus(List.of(shopId), ShopStatus.ACTIVE)).thenReturn(List.of(shop));

        List<ShopSummaryResponse> result = shopService.getShopsByIds(List.of(shopId));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().getShopName()).isEqualTo("Ravi Kirana");
        assertThat(result.getFirst().getVendorId()).isEqualTo(vendorId);
    }
}
