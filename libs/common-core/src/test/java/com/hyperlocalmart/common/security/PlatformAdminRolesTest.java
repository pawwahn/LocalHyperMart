package com.hyperlocalmart.common.security;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PlatformAdminRolesTest {

    @Test
    void staffIncludesAllThreePortalRoles() {
        assertThat(PlatformAdminRoles.isPlatformStaff(List.of(PlatformAdminRoles.SUPER_ADMIN))).isTrue();
        assertThat(PlatformAdminRoles.isPlatformStaff(List.of(PlatformAdminRoles.APP_ADMIN_WRITE))).isTrue();
        assertThat(PlatformAdminRoles.isPlatformStaff(List.of(PlatformAdminRoles.APP_ADMIN_READ))).isTrue();
        assertThat(PlatformAdminRoles.isPlatformStaff(List.of("BUYER"))).isFalse();
    }

    @Test
    void writeIsSuperAndWriteOnly() {
        assertThat(PlatformAdminRoles.canWriteConfig(List.of(PlatformAdminRoles.APP_ADMIN_WRITE))).isTrue();
        assertThat(PlatformAdminRoles.canWriteConfig(List.of(PlatformAdminRoles.APP_ADMIN_READ))).isFalse();
    }

    @Test
    void moneyMovementIsSuperAdminOnly() {
        assertThat(PlatformAdminRoles.canMoveMoney(List.of(PlatformAdminRoles.SUPER_ADMIN))).isTrue();
        assertThat(PlatformAdminRoles.canMoveMoney(List.of(PlatformAdminRoles.APP_ADMIN_WRITE))).isFalse();
        assertThat(PlatformAdminRoles.canMoveMoney(List.of(PlatformAdminRoles.APP_ADMIN_READ))).isFalse();
    }

    @Test
    void issueBillsAllowedForAllStaff() {
        assertThat(PlatformAdminRoles.canIssueBills(List.of(PlatformAdminRoles.APP_ADMIN_READ))).isTrue();
    }
}
