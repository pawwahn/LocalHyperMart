package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.dto.response.CashHolderContextResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderCashHolderContextService {

    private final OrderRepository orderRepository;
    private final VendorSubOrderRepository vendorSubOrderRepository;

    @Transactional(readOnly = true)
    public List<CashHolderContextResponse> resolve(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        return orderRepository.findAllById(orderIds).stream().map(this::toContext).toList();
    }

    private CashHolderContextResponse toContext(Order order) {
        UUID vendorId = null;
        if (order.isVendorAgentDelivery()) {
            List<VendorSubOrder> subs = vendorSubOrderRepository.findByOrderIdWithItems(order.getId());
            vendorId = soleVendorId(subs);
        }
        PaymentMethod pay = order.getPaymentMethod();
        return CashHolderContextResponse.builder()
                .orderId(order.getId())
                .paymentMethod(pay == null ? null : pay.name())
                .vendorAgentDelivery(order.isVendorAgentDelivery())
                .townId(order.getTownId())
                .vendorId(vendorId)
                .build();
    }

    private static UUID soleVendorId(List<VendorSubOrder> subOrders) {
        if (subOrders == null || subOrders.isEmpty()) {
            return null;
        }
        return subOrders.stream()
                .map(VendorSubOrder::getVendorId)
                .filter(id -> id != null)
                .findFirst()
                .orElse(null);
    }
}
