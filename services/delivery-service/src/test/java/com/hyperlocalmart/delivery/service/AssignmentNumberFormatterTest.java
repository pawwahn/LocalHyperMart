package com.hyperlocalmart.delivery.service;

import org.junit.jupiter.api.Test;

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
}
