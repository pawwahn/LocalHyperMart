package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ServiceAreaCheckTest {

    @Test
    void allowsListedPincode() {
        assertThatCode(() -> ServiceAreaCheck.requireServed("Chirala, Andhra Pradesh", List.of("523155", "523187"), "523187"))
                .doesNotThrowAnyException();
    }

    @Test
    void skipsWhenTownHasNoPincodes() {
        assertThatCode(() -> ServiceAreaCheck.requireServed("Chirala", List.of(), "500001"))
                .doesNotThrowAnyException();
        assertThatCode(() -> ServiceAreaCheck.requireServed("Chirala", null, null))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsPinOutsideTheTown() {
        assertThatThrownBy(() -> ServiceAreaCheck.requireServed("Chirala, Andhra Pradesh", List.of("523155"), "500001"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("500001");
    }

    @Test
    void rejectsBlankPinWhenTownListsPincodes() {
        assertThatThrownBy(() -> ServiceAreaCheck.requireServed("Chirala, Andhra Pradesh", List.of("523155"), " "))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("listed pincodes");
    }
}
