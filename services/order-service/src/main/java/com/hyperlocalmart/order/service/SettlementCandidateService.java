package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.dto.response.DeliveredVendorTown;
import com.hyperlocalmart.order.dto.response.SettlementBagKey;
import com.hyperlocalmart.order.dto.response.SettlementCandidateResponse;
import com.hyperlocalmart.order.entity.LaundryOrder;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.laundry.LaundryOrderStatus;
import com.hyperlocalmart.order.laundry.LaundryPaymentStatus;
import com.hyperlocalmart.order.repository.LaundryOrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SettlementCandidateService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final LaundryOrderRepository laundryOrderRepository;

    /**
     * Lists vendor bags eligible for payout: status must be {@code DELIVERED}
     * and placed date within {@code [from, to]} (IST calendar days).
     */
    @Transactional(readOnly = true)
    public SettlementCandidateResponse listCandidates(UUID vendorId, UUID townId, LocalDate from, LocalDate to) {
        // Match admin From/To calendar days in IST (not UTC midnight).
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        List<VendorSubOrder> rows = vendorSubOrderRepository.findSettlementCandidates(vendorId, townId, start, end);
        List<SettlementCandidateResponse.Item> items = new ArrayList<>();
        rows.stream().map(this::toItem).forEach(items::add);
        laundryOrderRepository.findSettlementCandidates(vendorId, townId, start, end).stream()
                .map(this::toLaundryItem)
                .forEach(items::add);
        return SettlementCandidateResponse.builder()
                .vendorId(vendorId)
                .townId(townId)
                .from(from.toString())
                .to(to.toString())
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public List<SettlementBagKey> listBagKeys(LocalDate from, LocalDate to) {
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        List<SettlementBagKey> out = new ArrayList<>();
        for (Object[] row : vendorSubOrderRepository.findSettlementBagKeys(start, end)) {
            if (row == null || row.length < 3) {
                continue;
            }
            UUID vendorId = uuid(row[0]);
            UUID townId = uuid(row[1]);
            UUID subOrderId = uuid(row[2]);
            if (vendorId == null || townId == null || subOrderId == null) {
                continue;
            }
            out.add(new SettlementBagKey(vendorId, townId, subOrderId));
        }
        for (Object[] row : laundryOrderRepository.findSettlementKeys(start, end)) {
            if (row == null || row.length < 3) {
                continue;
            }
            UUID vendorId = uuid(row[0]);
            UUID townId = uuid(row[1]);
            UUID orderId = uuid(row[2]);
            if (vendorId == null || townId == null || orderId == null) {
                continue;
            }
            out.add(new SettlementBagKey(vendorId, townId, orderId));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<DeliveredVendorTown> listDeliveredVendorTowns(LocalDate from, LocalDate to) {
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        Map<String, DeliveredVendorTown> towns = new LinkedHashMap<>();
        for (Object[] row : vendorSubOrderRepository.findDeliveredVendorTowns(start, end)) {
            addVendorTown(towns, row);
        }
        for (Object[] row : laundryOrderRepository.findDeliveredVendorTowns(start, end)) {
            addVendorTown(towns, row);
        }
        return new ArrayList<>(towns.values());
    }

    private static void addVendorTown(Map<String, DeliveredVendorTown> towns, Object[] row) {
        if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
            return;
        }
        UUID vendorId = UUID.fromString(row[0].toString());
        UUID townId = UUID.fromString(row[1].toString());
        towns.putIfAbsent(vendorId + "|" + townId, new DeliveredVendorTown(vendorId, townId));
    }

    @Transactional(readOnly = true)
    public List<SettlementCandidateResponse.Item> resolveSubOrders(UUID vendorId, Collection<UUID> subOrderIds) {
        if (subOrderIds == null || subOrderIds.isEmpty()) {
            return List.of();
        }
        List<SettlementCandidateResponse.Item> items = new ArrayList<>();
        Set<UUID> found = new HashSet<>();
        for (VendorSubOrder subOrder : vendorSubOrderRepository.findByVendorIdAndIdIn(vendorId, subOrderIds)) {
            items.add(toItem(subOrder));
            found.add(subOrder.getId());
        }
        List<UUID> laundryIds = subOrderIds.stream().filter(id -> !found.contains(id)).toList();
        if (!laundryIds.isEmpty()) {
            for (LaundryOrder order : laundryOrderRepository.findByVendorIdAndIdIn(vendorId, laundryIds)) {
                if (order.getStatus() == LaundryOrderStatus.DELIVERED) {
                    items.add(toLaundryItem(order));
                }
            }
        }
        return items;
    }

    private static UUID uuid(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof UUID id) {
            return id;
        }
        return UUID.fromString(value.toString());
    }

    /** Shop-agent money follows this bag. A sibling bag on the same order can still be a hub bag. */
    private static boolean isShopAgentBag(VendorSubOrder subOrder) {
        if (subOrder.getVendorAgentDeliveryAt() != null) {
            return true;
        }
        Order order = subOrder.getOrder();
        if (order == null || !order.isVendorAgentDelivery() || order.getVendorSubOrders() == null) {
            return false;
        }
        long activeBags = order.getVendorSubOrders().stream()
                .filter(bag -> !bag.getStatus().isClosed())
                .count();
        return activeBags <= 1;
    }

    /** Buyer platform fee follows the goods share so a mixed order is not billed twice. */
    private static BigDecimal platformFeeShare(VendorSubOrder subOrder) {
        Order order = subOrder.getOrder();
        BigDecimal fee = order.getPlatformFee() == null ? BigDecimal.ZERO : order.getPlatformFee();
        if (fee.signum() <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        List<VendorSubOrder> active = order.getVendorSubOrders() == null
                ? List.of(subOrder)
                : order.getVendorSubOrders().stream().filter(bag -> !bag.getStatus().isClosed()).toList();
        if (active.size() <= 1) {
            return fee.setScale(2, RoundingMode.HALF_UP);
        }
        List<VendorSubOrder> ordered = active.stream()
                .sorted(Comparator.comparing(VendorSubOrder::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        BigDecimal goodsTotal = ordered.stream()
                .map(bag -> bag.getSubtotal() == null ? BigDecimal.ZERO : bag.getSubtotal())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal allocated = BigDecimal.ZERO;
        for (int i = 0; i < ordered.size(); i++) {
            BigDecimal share;
            if (i == ordered.size() - 1) {
                share = fee.subtract(allocated);
            } else if (goodsTotal.signum() <= 0) {
                share = fee.divide(BigDecimal.valueOf(ordered.size()), 2, RoundingMode.HALF_UP);
                allocated = allocated.add(share);
            } else {
                BigDecimal bagGoods = ordered.get(i).getSubtotal() == null ? BigDecimal.ZERO : ordered.get(i).getSubtotal();
                share = fee.multiply(bagGoods).divide(goodsTotal, 2, RoundingMode.HALF_UP);
                allocated = allocated.add(share);
            }
            if (ordered.get(i).getId().equals(subOrder.getId())) {
                return share.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            }
        }
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private SettlementCandidateResponse.Item toItem(VendorSubOrder subOrder) {
        return SettlementCandidateResponse.Item.builder()
                .subOrderId(subOrder.getId())
                .orderId(subOrder.getOrder().getId())
                .orderNumber(subOrder.getOrder().getOrderNumber())
                .subOrderNumber(subOrder.getSubOrderNumber())
                .placedAt(subOrder.getOrder().getPlacedAt())
                .deliveredAt(subOrder.getOrder().getDeliveredAt())
                .status(subOrder.getStatus())
                .paymentStatus(subOrder.getOrder().getPaymentStatus())
                .paymentMethod(subOrder.getOrder().getPaymentMethod())
                .vendorAgentDelivery(isShopAgentBag(subOrder))
                .subtotal(subOrder.getSubtotal())
                .platformFee(platformFeeShare(subOrder))
                .build();
    }

    /** Laundry cash stays at the shop, so settlement bills the platform fee instead of paying the goods. */
    private SettlementCandidateResponse.Item toLaundryItem(LaundryOrder order) {
        boolean online = order.getPaymentMethod() == com.hyperlocalmart.order.laundry.LaundryPaymentMethod.UPI;
        return SettlementCandidateResponse.Item.builder()
                .subOrderId(order.getId())
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .subOrderNumber(order.getOrderNumber())
                .placedAt(order.getPlacedAt())
                .deliveredAt(order.getDeliveredAt())
                .status(VendorSubOrderStatus.DELIVERED)
                .paymentStatus(laundryPayment(order.getPaymentStatus()))
                .paymentMethod(online ? PaymentMethod.ONLINE : PaymentMethod.COD)
                .vendorAgentDelivery(!online)
                .subtotal(order.getGoodsAmount())
                .pieceCount(order.getPieceCount())
                .platformFee(online || order.getPlatformFeeAmount() == null
                        ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                        : order.getPlatformFeeAmount())
                .codFee(online || order.getCodFee() == null
                        ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                        : order.getCodFee())
                .build();
    }

    private static PaymentStatus laundryPayment(LaundryPaymentStatus status) {
        if (status == LaundryPaymentStatus.COLLECTED) {
            return PaymentStatus.PAID;
        }
        if (status == LaundryPaymentStatus.REFUNDED || status == LaundryPaymentStatus.REFUND_DUE) {
            return PaymentStatus.REFUNDED;
        }
        return PaymentStatus.PENDING;
    }
}
