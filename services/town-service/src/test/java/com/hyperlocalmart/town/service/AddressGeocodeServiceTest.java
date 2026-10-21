package com.hyperlocalmart.town.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AddressGeocodeServiceTest {

    @Test
    void candidates_dropTheLandmarkThenKeepTheTown() {
        var queries = AddressGeocodeService.candidates(
                "12 main road, near temple, chirala, andhra pradesh 523155");

        assertThat(queries).startsWith("12 main road, near temple, chirala, andhra pradesh 523155");
        assertThat(queries).contains("12 main road, chirala, andhra pradesh 523155");
        assertThat(queries).anyMatch(q -> q.contains("chirala"));
        assertThat(queries).hasSizeLessThanOrEqualTo(3);
    }
}
