package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class OrderSiblingBagsTest {

    @Test
    void attach_splitsPlatformFee_whenSiblingsHydrated() {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setPlatformFee(new BigDecimal("3.00"));
        VendorSubOrder a = bag(order, "800.00");
        VendorSubOrder b = bag(order, "1045.00");
        List<VendorSubOrder> seed = List.of(a);
        OrderSiblingBags.attach(seed, List.of(a, b));

        assertThat(OrderBuyerFeeShare.platformFee(a)).isEqualByComparingTo("1.30");
    }

    @Test
    void withoutAttach_treatsEachBagAsFullOrderPlatformFee() {
        Order order1 = new Order();
        order1.setPlatformFee(new BigDecimal("1.50"));
        VendorSubOrder bag1 = bag(order1, "800.00");

        Order order2 = new Order();
        order2.setPlatformFee(new BigDecimal("1.50"));
        VendorSubOrder bag2 = bag(order2, "1045.00");

        assertThat(OrderBuyerFeeShare.platformFee(bag1)).isEqualByComparingTo("1.50");
        assertThat(OrderBuyerFeeShare.platformFee(bag2)).isEqualByComparingTo("1.50");
        assertThat(OrderBuyerFeeShare.platformFee(bag1).add(OrderBuyerFeeShare.platformFee(bag2)))
                .isEqualByComparingTo("3.00");
    }

    private static VendorSubOrder bag(Order order, String subtotal) {
        VendorSubOrder sub = new VendorSubOrder();
        sub.setId(UUID.randomUUID());
        sub.setOrder(order);
        sub.setSubtotal(new BigDecimal(subtotal));
        sub.setStatus(VendorSubOrderStatus.DELIVERED);
        return sub;
    }
}
