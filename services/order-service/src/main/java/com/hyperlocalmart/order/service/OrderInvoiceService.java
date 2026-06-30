package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.service.invoice.InvoiceDocument;
import com.hyperlocalmart.order.service.invoice.InvoicePdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderInvoiceService {

    private final OrderRepository orderRepository;
    private final TownClient townClient;
    private final InvoicePdfService invoicePdfService;

    @Transactional(readOnly = true)
    public InvoicePdfResult generateInvoice(UUID buyerId, UUID orderId) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        if (!isInvoiceAvailable(order)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice is not available for this order yet");
        }
        TownClient.TownSummary town = townClient.getTownSummary(order.getTownId());
        byte[] pdf = invoicePdfService.generate(toInvoiceDocument(order, town.displayName()));
        return new InvoicePdfResult(order.getOrderNumber(), pdf);
    }

    public boolean isInvoiceAvailable(Order order) {
        return order.getStatus() != OrderStatus.PAYMENT_PENDING
                && order.getStatus() != OrderStatus.PAYMENT_FAILED;
    }

    public String invoicePdfUrl(Order order) {
        return isInvoiceAvailable(order) ? "/api/v1/orders/" + order.getId() + "/invoice" : null;
    }

    private InvoiceDocument toInvoiceDocument(Order order, String townName) {
        List<InvoiceDocument.InvoiceLineItem> lineItems = new ArrayList<>();
        for (VendorSubOrder subOrder : order.getVendorSubOrders()) {
            for (OrderItem item : subOrder.getItems()) {
                lineItems.add(InvoiceDocument.InvoiceLineItem.builder()
                        .itemName(item.getItemNameSnapshot())
                        .shopName(item.getShopNameSnapshot())
                        .unitCode(item.getUnitCodeSnapshot())
                        .quantity(item.getQuantity())
                        .unitPrice(item.getDiscountPrice() != null ? item.getDiscountPrice() : item.getUnitPrice())
                        .lineTotal(item.getLineTotal())
                        .build());
            }
        }
        return InvoiceDocument.builder()
                .orderNumber(order.getOrderNumber())
                .townName(townName)
                .placedAt(order.getPlacedAt() != null ? order.getPlacedAt() : order.getCreatedAt())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .deliveryAddress(order.getDeliveryAddressSnapshot())
                .buyerPhone(order.getBuyerPhoneSnapshot())
                .itemsSubtotal(order.getItemsSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .platformFee(order.getPlatformFee())
                .taxAmount(order.getTaxAmount())
                .totalAmount(order.getTotalAmount())
                .lineItems(lineItems)
                .build();
    }

    public record InvoicePdfResult(String orderNumber, byte[] content) {
    }
}
