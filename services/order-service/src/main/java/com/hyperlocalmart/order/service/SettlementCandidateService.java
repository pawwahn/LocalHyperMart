package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.dto.response.SettlementCandidateResponse;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SettlementCandidateService {

    private final VendorSubOrderRepository vendorSubOrderRepository;

    @Transactional(readOnly = true)
    public SettlementCandidateResponse listCandidates(UUID vendorId, UUID townId, LocalDate from, LocalDate to) {
        Instant start = from.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant end = to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        List<VendorSubOrder> rows = vendorSubOrderRepository.findSettlementCandidates(vendorId, townId, start, end);
        return SettlementCandidateResponse.builder()
                .vendorId(vendorId)
                .townId(townId)
                .from(from.toString())
                .to(to.toString())
                .items(rows.stream().map(this::toItem).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public List<SettlementCandidateResponse.Item> resolveSubOrders(UUID vendorId, Collection<UUID> subOrderIds) {
        if (subOrderIds == null || subOrderIds.isEmpty()) {
            return List.of();
        }
        return vendorSubOrderRepository.findByVendorIdAndIdIn(vendorId, subOrderIds).stream()
                .map(this::toItem)
                .toList();
    }

    private SettlementCandidateResponse.Item toItem(VendorSubOrder subOrder) {
        return SettlementCandidateResponse.Item.builder()
                .subOrderId(subOrder.getId())
                .orderId(subOrder.getOrder().getId())
                .orderNumber(subOrder.getOrder().getOrderNumber())
                .subOrderNumber(subOrder.getSubOrderNumber())
                .placedAt(subOrder.getOrder().getPlacedAt())
                .status(subOrder.getStatus())
                .paymentStatus(subOrder.getOrder().getPaymentStatus())
                .subtotal(subOrder.getSubtotal())
                .build();
    }
}
