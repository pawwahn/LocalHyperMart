package com.hyperlocalmart.delivery.service;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AssignmentNumberFormatterTest {

    @Test
    void pickup_appendsReadableSuffix() {
        assertThat(AssignmentNumberFormatter.pickup("NRPT/AP-080726-0001-1/3"))
                .isEqualTo("NRPT/AP-080726-0001-1/3-TO-HUB");
    }

    @Test
    void lastMile_appendsReadableSuffix() {
        assertThat(AssignmentNumberFormatter.lastMile("NRPT/AP-080726-0001"))
                .isEqualTo("NRPT/AP-080726-0001-TO-BUYER");
    }

    @Test
    void laundry_separatesPickupAndDrop() {
        assertThat(AssignmentNumberFormatter.laundry("L261022-0001", "PICKUP_FROM_CUSTOMER"))
                .isEqualTo("L261022-0001-LAUNDRY-PICKUP");
        assertThat(AssignmentNumberFormatter.laundry("L261022-0001", "DROP_TO_CUSTOMER"))
                .isEqualTo("L261022-0001-LAUNDRY-DROP");
    }

    @Test
    void releasedUnique_appendsShortIdSuffix() {
        UUID id = UUID.fromString("3923e3d0-db0a-4425-9915-f2abfca15603");
        assertThat(AssignmentNumberFormatter.releasedUnique("L261022-0001-LAUNDRY", id))
                .isEqualTo("L261022-0001-LAUNDRY-X-3923e3d0");
    }
}
