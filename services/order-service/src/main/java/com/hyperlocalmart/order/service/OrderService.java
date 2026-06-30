package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.AddressClient;
import com.hyperlocalmart.order.client.CartClient;
import com.hyperlocalmart.order.client.CatalogClient;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.config.CheckoutProperties;
import com.hyperlocalmart.order.dto.request.CreateOrderRequest;
import com.hyperlocalmart.order.dto.request.DeliverOrderRequest;
import com.hyperlocalmart.order.dto.request.PaymentCallbackRequest;
import com.hyperlocalmart.order.dto.response.*;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderStatusHistoryRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final CartClient cartClient;
    private final AddressClient addressClient;
    private final TownClient townClient;
    private final OrderNumberGenerator orderNumberGenerator;
    private final IdempotencyService idempotencyService;
    private final CheckoutProperties checkoutProperties;
    private final PaymentClient paymentClient;
    private final NotificationClient notificationClient;
    private final CatalogClient catalogClient;
    private final OrderInvoiceService orderInvoiceService;

    @Transactional
    public CreateOrderResponse createOrder(UUID buyerId, String buyerPhone, String idempotencyKey, CreateOrderRequest request) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Idempotency-Key header is required");
        }

        return idempotencyService.findValidResponse(idempotencyKey)
                .orElseGet(() -> createOrderInternal(buyerId, buyerPhone, idempotencyKey, request));
    }

    @Transactional(readOnly = true)
    public OrderDetailResponse getOrder(UUID buyerId, UUID orderId) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        return toDetail(order);
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummaryResponse> listOrders(UUID buyerId, UUID townId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<Order> orders = orderRepository.findByBuyerIdAndTownIdOrderByCreatedAtDesc(buyerId, townId, pageable);
        List<OrderSummaryResponse> items = orders.getContent().stream().map(this::toSummary).toList();
        return PageResponse.<OrderSummaryResponse>builder()
                .items(items)
                .page(orders.getNumber())
                .size(orders.getSize())
                .totalElements(orders.getTotalElements())
                .totalPages(orders.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public OrderInternalSnapshotResponse getOrderSnapshot(UUID orderId, UUID buyerId) {
        Order order = orderRepository.findByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        return OrderInternalSnapshotResponse.builder()
                .orderId(order.getId())
                .buyerId(order.getBuyerId())
                .townId(order.getTownId())
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .totalAmount(order.getTotalAmount())
                .build();
    }

    @Transactional(readOnly = true)
    public SubOrderInternalSnapshotResponse getSubOrderSnapshot(UUID subOrderId) {
        VendorSubOrder subOrder = vendorSubOrderRepository.findDetailedById(subOrderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Sub-order not found"));
        return SubOrderInternalSnapshotResponse.builder()
                .subOrderId(subOrder.getId())
                .orderId(subOrder.getOrder().getId())
                .townId(subOrder.getOrder().getTownId())
                .vendorId(subOrder.getVendorId())
                .status(subOrder.getStatus().name())
                .orderNumber(subOrder.getOrder().getOrderNumber())
                .build();
    }

    @Transactional(readOnly = true)
    public OrderDeliveryInfoResponse getDeliveryInfo(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        return OrderDeliveryInfoResponse.builder()
                .orderId(order.getId())
                .buyerId(order.getBuyerId())
                .townId(order.getTownId())
                .status(order.getStatus().name())
                .orderNumber(order.getOrderNumber())
                .buyerPhone(order.getBuyerPhoneSnapshot())
                .build();
    }

    @Transactional
    public void markDelivered(UUID orderId, DeliverOrderRequest request) {
        Order order = orderRepository.findWithSubOrdersById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        if (order.getStatus() != OrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order cannot be marked delivered");
        }

        OrderStatus priorStatus = order.getStatus();
        order.setStatus(OrderStatus.DELIVERED);
        order.setDeliveredAt(Instant.now());
        for (VendorSubOrder subOrder : order.getVendorSubOrders()) {
            if (subOrder.getStatus() != VendorSubOrderStatus.VENDOR_REJECTED) {
                subOrder.setStatus(VendorSubOrderStatus.DELIVERED);
            }
        }
        orderRepository.save(order);

        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .fromStatus(priorStatus.name())
                .toStatus(OrderStatus.DELIVERED.name())
                .changedBy(request.getAgentUserId())
                .changedByRole("DELIVERY_AGENT")
                .note(request.getRecipientName() != null ? "Delivered to " + request.getRecipientName() : "Delivered")
                .build());

        notificationClient.notifyOrderDelivered(
                order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                order.getOrderNumber());
    }

    @Transactional(readOnly = true)
    public ReorderResponse reorder(UUID buyerId, UUID orderId) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        if (order.getStatus() != OrderStatus.PLACED && order.getStatus() != OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order cannot be reordered");
        }

        boolean priceChanged = false;
        List<CartClient.ReorderLine> lines = new ArrayList<>();

        for (VendorSubOrder subOrder : order.getVendorSubOrders()) {
            for (OrderItem item : subOrder.getItems()) {
                CatalogClient.ListingSnapshot listing;
                try {
                    listing = catalogClient.getListing(item.getListingId(), order.getTownId());
                } catch (Exception ex) {
                    throw new BusinessException(ErrorCode.NOT_FOUND,
                            "Item no longer available: " + item.getItemNameSnapshot());
                }
                BigDecimal snapshotPrice = effectivePrice(item.getUnitPrice(), item.getDiscountPrice());
                BigDecimal currentPrice = effectivePrice(listing.price(), listing.discountPrice());
                if (snapshotPrice.compareTo(currentPrice) != 0) {
                    priceChanged = true;
                }
                lines.add(new CartClient.ReorderLine(item.getListingId(), item.getQuantity()));
            }
        }

        if (lines.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Order has no items to reorder");
        }

        CartClient.ReorderCartResult cart = cartClient.replaceCartItems(buyerId, order.getTownId(), lines);
        return ReorderResponse.builder()
                .cartId(cart.cartId())
                .townId(cart.townId())
                .itemsSubtotal(cart.itemsSubtotal())
                .itemCount(cart.itemCount())
                .minOrderMet(cart.minOrderMet())
                .priceChanged(priceChanged)
                .build();
    }

    private BigDecimal effectivePrice(BigDecimal unitPrice, BigDecimal discountPrice) {
        return discountPrice != null ? discountPrice : unitPrice;
    }

    @Transactional
    public void markPaymentSuccess(UUID orderId, PaymentCallbackRequest request) {
        Order order = orderRepository.findByIdAndBuyerId(orderId, request.getBuyerId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        if (order.getStatus() != OrderStatus.PAYMENT_PENDING && order.getStatus() != OrderStatus.PAYMENT_FAILED) {
            return;
        }
        order.setStatus(OrderStatus.PLACED);
        order.setPaymentStatus(PaymentStatus.PAID);
        order.setPlacedAt(Instant.now());
        orderRepository.save(order);
        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .fromStatus(OrderStatus.PAYMENT_PENDING.name())
                .toStatus(OrderStatus.PLACED.name())
                .changedBy(request.getBuyerId())
                .changedByRole("SYSTEM")
                .note("Payment confirmed: " + request.getPaymentId())
                .build());
        notificationClient.notifyOrderPlaced(
                order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                order.getOrderNumber(), order.getTotalAmount());
    }

    @Transactional
    public void markPaymentFailed(UUID orderId, PaymentCallbackRequest request) {
        Order order = orderRepository.findByIdAndBuyerId(orderId, request.getBuyerId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        if (order.getStatus() != OrderStatus.PAYMENT_PENDING) {
            return;
        }
        order.setStatus(OrderStatus.PAYMENT_FAILED);
        order.setPaymentStatus(PaymentStatus.FAILED);
        orderRepository.save(order);
        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .fromStatus(OrderStatus.PAYMENT_PENDING.name())
                .toStatus(OrderStatus.PAYMENT_FAILED.name())
                .changedBy(request.getBuyerId())
                .changedByRole("SYSTEM")
                .note(request.getReason())
                .build());
    }

    private CreateOrderResponse createOrderInternal(UUID buyerId, String buyerPhone, String idempotencyKey, CreateOrderRequest request) {
        CartClient.CartSnapshot cart = cartClient.getCart(request.getCartId(), buyerId, request.getTownId());
        Map<String, Object> addressSnapshot = addressClient.getAddressSnapshot(request.getAddressId(), buyerId, request.getTownId());
        TownClient.TownSummary town = townClient.getTownSummary(request.getTownId());

        String orderNumber = orderNumberGenerator.nextOrderNumber(request.getTownId(), town.townCode(), town.stateCode());
        BigDecimal deliveryFee = checkoutProperties.getDeliveryFee();
        BigDecimal totalAmount = cart.itemsSubtotal().add(deliveryFee);

        boolean isCod = request.getPaymentMethod() == PaymentMethod.COD;
        OrderStatus orderStatus = isCod ? OrderStatus.PLACED : OrderStatus.PAYMENT_PENDING;
        PaymentStatus paymentStatus = isCod ? PaymentStatus.PAID : PaymentStatus.PENDING;

        Order order = Order.builder()
                .orderNumber(orderNumber)
                .townId(request.getTownId())
                .buyerId(buyerId)
                .cartId(request.getCartId())
                .status(orderStatus)
                .paymentMethod(request.getPaymentMethod())
                .paymentStatus(paymentStatus)
                .itemsSubtotal(cart.itemsSubtotal())
                .deliveryFee(deliveryFee)
                .totalAmount(totalAmount)
                .deliveryAddressSnapshot(addressSnapshot)
                .buyerPhoneSnapshot(buyerPhone)
                .placedAt(isCod ? Instant.now() : null)
                .build();

        buildVendorSubOrders(order, cart);
        orderRepository.save(order);

        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .toStatus(orderStatus.name())
                .changedBy(buyerId)
                .changedByRole("BUYER")
                .note("Order created")
                .build());

        cartClient.convertCart(request.getCartId(), buyerId, request.getTownId());

        PaymentInfoResponse paymentInfo = null;
        if (!isCod) {
            paymentInfo = paymentClient.initiatePayment(
                    buyerId, order.getId(), request.getTownId(), request.getPaymentGateway(), idempotencyKey + "-pay");
        }

        CreateOrderResponse response = CreateOrderResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .payment(paymentInfo)
                .build();

        idempotencyService.save(idempotencyKey, buyerId, order.getId(), response);

        if (isCod) {
            notificationClient.notifyOrderPlaced(
                    order.getTownId(), order.getId(), buyerId, buyerPhone,
                    order.getOrderNumber(), order.getTotalAmount());
        }
        return response;
    }

    private void buildVendorSubOrders(Order order, CartClient.CartSnapshot cart) {
        Map<String, List<CartClient.CartItemSnapshot>> grouped = cart.items().stream()
                .collect(Collectors.groupingBy(item -> item.vendorId() + ":" + item.shopId()));

        for (List<CartClient.CartItemSnapshot> groupItems : grouped.values()) {
            CartClient.CartItemSnapshot first = groupItems.getFirst();
            BigDecimal subtotal = groupItems.stream()
                    .map(CartClient.CartItemSnapshot::lineTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            VendorSubOrder subOrder = VendorSubOrder.builder()
                    .order(order)
                    .vendorId(first.vendorId())
                    .shopId(first.shopId())
                    .status(VendorSubOrderStatus.PLACED)
                    .subtotal(subtotal)
                    .items(new ArrayList<>())
                    .build();

            for (CartClient.CartItemSnapshot item : groupItems) {
                subOrder.getItems().add(OrderItem.builder()
                        .vendorSubOrder(subOrder)
                        .listingId(item.listingId())
                        .masterItemId(item.masterItemId())
                        .itemNameSnapshot(item.itemName())
                        .shopNameSnapshot(item.shopName())
                        .quantity(item.quantity())
                        .unitPrice(item.unitPrice())
                        .discountPrice(item.discountPrice())
                        .lineTotal(item.lineTotal())
                        .build());
            }
            order.getVendorSubOrders().add(subOrder);
        }
    }

    private OrderSummaryResponse toSummary(Order order) {
        int itemCount = order.getVendorSubOrders().stream()
                .flatMap(sub -> sub.getItems().stream())
                .mapToInt(OrderItem::getQuantity)
                .sum();
        return OrderSummaryResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .status(order.getStatus())
                .displayStatus(displayStatus(order.getStatus()))
                .totalAmount(order.getTotalAmount())
                .paymentStatus(order.getPaymentStatus())
                .placedAt(order.getPlacedAt())
                .itemCount(itemCount)
                .build();
    }

    private OrderDetailResponse toDetail(Order order) {
        List<OrderItemDetailResponse> items = new ArrayList<>();
        for (VendorSubOrder subOrder : order.getVendorSubOrders()) {
            for (OrderItem item : subOrder.getItems()) {
                items.add(OrderItemDetailResponse.builder()
                        .name(item.getItemNameSnapshot())
                        .shopName(item.getShopNameSnapshot())
                        .quantity(item.getQuantity())
                        .lineTotal(item.getLineTotal())
                        .build());
            }
        }
        return OrderDetailResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .status(order.getStatus())
                .displayStatus(displayStatus(order.getStatus()))
                .itemsSubtotal(order.getItemsSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .totalAmount(order.getTotalAmount())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .deliveryAddress(order.getDeliveryAddressSnapshot())
                .items(items)
                .invoicePdfUrl(orderInvoiceService.invoicePdfUrl(order))
                .build();
    }

    private String displayStatus(OrderStatus status) {
        return switch (status) {
            case PAYMENT_PENDING -> "Awaiting Payment";
            case PLACED -> "Order Placed";
            case PAYMENT_FAILED -> "Payment Failed";
            case CANCELLED -> "Cancelled";
            case DELIVERED -> "Delivered";
        };
    }
}
