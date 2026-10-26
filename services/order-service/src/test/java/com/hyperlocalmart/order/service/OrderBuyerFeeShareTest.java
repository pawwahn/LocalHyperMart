package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class OrderBuyerFeeShareTest {

    @Test
    void buyerPayableSubtractsCheckoutStoreCredit() {
        Order order = new Order();
        order.setItemsSubtotal(new BigDecimal("561.00"));
        order.setDeliveryFee(new BigDecimal("10.00"));
        order.setPlatformFee(new BigDecimal("2.00"));
        order.setCodFee(new BigDecimal("10.00"));
        order.setStoreCreditApplied(new BigDecimal("514.00"));

        assertThat(OrderService.grossBuyerTotal(order)).isEqualByComparingTo("583.00");
        assertThat(OrderService.buyerPayableTotal(order)).isEqualByComparingTo("69.00");
    }

    @Test
    void splitsCodAndMembershipByGoodsShare() {
        Order order = new Order();
        order.setCodFee(new BigDecimal("10.00"));
        order.setMembershipFee(new BigDecimal("199.00"));
        VendorSubOrder a = bag(order, "576.00");
        order.setVendorSubOrders(List.of(a));

        assertThat(OrderBuyerFeeShare.codFee(a)).isEqualByComparingTo("10.00");
        assertThat(OrderBuyerFeeShare.membershipFee(a)).isEqualByComparingTo("199.00");
    }

    @Test
    void assignsFullDeliveryFeeWhenOnlyActiveBag() {
        Order order = new Order();
        order.setDeliveryFee(new BigDecimal("20.00"));
        VendorSubOrder a = bag(order, "20.00");
        order.setVendorSubOrders(List.of(a));

        assertThat(OrderBuyerFeeShare.deliveryFee(a)).isEqualByComparingTo("20.00");
    }

    @Test
    void splitsPlatformFeeByGoodsShare() {
        Order order = new Order();
        order.setPlatformFee(new BigDecimal("3.00"));
        VendorSubOrder a = bag(order, "800.00");
        VendorSubOrder b = bag(order, "1045.00");
        order.setVendorSubOrders(List.of(a, b));

        assertThat(OrderBuyerFeeShare.platformFee(a)).isEqualByComparingTo("1.30");
        assertThat(OrderBuyerFeeShare.platformFee(b)).isEqualByComparingTo("1.70");
        assertThat(OrderBuyerFeeShare.platformFee(a).add(OrderBuyerFeeShare.platformFee(b)))
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
