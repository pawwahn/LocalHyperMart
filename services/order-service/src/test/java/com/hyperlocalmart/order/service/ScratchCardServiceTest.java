package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.Order;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class ScratchCardServiceTest {

    @Test
    void goodsTotal_isItemsMinusPromo_excludingDeliveryAndPlatform() {
        Order order = new Order();
        order.setItemsSubtotal(new BigDecimal("550.00"));
        order.setPromoDiscount(new BigDecimal("50.00"));
        order.setDeliveryFee(new BigDecimal("40.00"));
        order.setPlatformFee(new BigDecimal("5.00"));

        assertThat(ScratchCardService.goodsTotal(order)).isEqualByComparingTo("500.00");
    }

    @Test
    void goodsTotal_neverNegative() {
        Order order = new Order();
        order.setItemsSubtotal(new BigDecimal("40.00"));
        order.setPromoDiscount(new BigDecimal("50.00"));

        assertThat(ScratchCardService.goodsTotal(order)).isEqualByComparingTo("0.00");
    }
}
