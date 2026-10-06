package com.hyperlocalmart.payment.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VendorCodCashHolderLabelsTest {

    @Test
    void onlineSitsWithApp() {
        var view = VendorCodCashHolderLabels.describe("ONLINE", false, null, null, null);
        assertThat(view.holderRole()).isEqualTo("PLATFORM");
        assertThat(view.holderLabel()).isEqualTo("App");
    }

    @Test
    void confirmedVendorHandoverIsShop() {
        var view = VendorCodCashHolderLabels.describe("COD", true, "WITH_VENDOR", "Ravi", null);
        assertThat(view.holderRole()).isEqualTo("VENDOR");
        assertThat(view.holderLabel()).isEqualTo("Shop");
    }

    @Test
    void vendorAgentStillHoldingIsShopAgent() {
        var view = VendorCodCashHolderLabels.describe("COD", true, "WITH_AGENT", "Ravi", null);
        assertThat(view.holderRole()).isEqualTo("VENDOR_AGENT");
        assertThat(view.holderLabel()).isEqualTo("Shop agent");
        assertThat(view.holderDetail()).isEqualTo("Ravi");
    }

    @Test
    void hubRouteAgentStillHoldingIsHubAgent() {
        var view = VendorCodCashHolderLabels.describe("COD", false, "WITH_AGENT", "Kiran", "Town Hub");
        assertThat(view.holderRole()).isEqualTo("HUB_AGENT");
        assertThat(view.holderLabel()).isEqualTo("Hub agent");
        assertThat(view.holderDetail()).isEqualTo("Kiran");
    }

    @Test
    void remittedCloseDayIsHubDesk() {
        var view = VendorCodCashHolderLabels.describe("COD", false, "AT_HUB", "Kiran", "Town Hub");
        assertThat(view.holderRole()).isEqualTo("HUB_ADMIN");
        assertThat(view.holderLabel()).isEqualTo("Hub desk");
        assertThat(view.holderDetail()).isEqualTo("Town Hub");
    }
}
