package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.town.dto.response.TownDetailResponse;
import com.hyperlocalmart.town.dto.response.TownListResponse;
import com.hyperlocalmart.town.entity.Town;
import com.hyperlocalmart.town.entity.TownPincode;
import com.hyperlocalmart.town.entity.TownStatus;
import com.hyperlocalmart.town.repository.TownPincodeRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TownServiceTest {

    @Mock private TownRepository townRepository;
    @Mock private TownPincodeRepository townPincodeRepository;

    @InjectMocks
    private TownService townService;

    @Test
    void listTowns_returnsEnabledTowns() {
        Town town = pilotTown();
        when(townRepository.findByStatusOrderByDisplayNameAsc(TownStatus.ENABLED)).thenReturn(List.of(town));

        TownListResponse response = townService.listTowns(TownStatus.ENABLED);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getDisplayName()).isEqualTo("Narsaraopet (Andhra Pradesh)");
        assertThat(response.getItems().getFirst().isAcceptingOrders()).isTrue();
    }

    @Test
    void getTown_returnsDetailWithPincodes() {
        UUID townId = pilotTown().getId();
        Town town = pilotTown();
        when(townRepository.findById(townId)).thenReturn(Optional.of(town));
        when(townPincodeRepository.findByTownIdOrderByPincodeAsc(townId)).thenReturn(List.of(
                TownPincode.builder().pincode("522601").build(),
                TownPincode.builder().pincode("522603").build()
        ));

        TownDetailResponse response = townService.getTown(townId);

        assertThat(response.getTownCode()).isEqualTo("NRPT");
        assertThat(response.getPincodes()).containsExactly("522601", "522603");
    }

    @Test
    void getTown_throwsWhenNotFound() {
        UUID townId = UUID.randomUUID();
        when(townRepository.findById(townId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> townService.getTown(townId))
                .isInstanceOf(BusinessException.class);
    }

    private Town pilotTown() {
        return Town.builder()
                .id(UUID.fromString("a1111111-1111-4111-8111-111111111111"))
                .name("Narsaraopet")
                .state("Andhra Pradesh")
                .townCode("NRPT")
                .stateCode("AP")
                .displayName("Narsaraopet (Andhra Pradesh)")
                .coverageRadiusKm(new BigDecimal("10.00"))
                .status(TownStatus.ENABLED)
                .build();
    }
}
