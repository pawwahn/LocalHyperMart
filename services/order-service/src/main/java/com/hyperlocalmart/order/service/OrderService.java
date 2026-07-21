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
                .subOrderNumber(subOrder.getSubOrderNumber())
                .orderId(subOrder.getOrder().getId())
                .townId(subOrder.getOrder().getTownId())
                .vendorId(subOrder.getVendorId())
                .status(subOrder.getStatus().name())
                .orderNumber(subOrder.getOrder().getOrderNumber())
                .build();
    }

    @Transactional
    public SubOrderPickupManifestResponse getPickupManifest(UUID subOrderId) {
        VendorSubOrder subOrder = vendorSubOrderRepository.findDetailedByIdWithItems(subOrderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Sub-order not found"));

        UUID townId = subOrder.getOrder().getTownId();
        boolean dirty = false;
        List<PickupLineItemResponse> items = new ArrayList<>();
        for (OrderItem item : subOrder.getItems()) {
            if (item.getStatus() == OrderItemStatus.CANCELLED) {
                continue;
            }
            String unitCode = item.getUnitCodeSnapshot();
            if ((unitCode == null || unitCode.isBlank()) && item.getListingId() != null && townId != null) {
                try {
                    unitCode = catalogClient.getListingForOrderRead(item.getListingId(), townId).unit();
                    if (unitCode != null && !unitCode.isBlank()) {
                        item.setUnitCodeSnapshot(unitCode);
                        dirty = true;
                    }
                } catch (RuntimeException ignored) {
                    // Keep null; UI will show a clear "qty" fallback.
                }
            }
            items.add(PickupLineItemResponse.builder()
                    .name(item.getItemNameSnapshot())
                    .quantity(item.getQuantity())
                    .unitCode(unitCode)
                    .lineTotal(item.getLineTotal())
                    .build());
        }
        if (dirty) {
            vendorSubOrderRepository.save(subOrder);
        }

        int totalItemCount = items.stream().mapToInt(PickupLineItemResponse::getQuantity).sum();
        String shopName = subOrder.getItems().isEmpty()
                ? "Vendor shop"
                : subOrder.getItems().getFirst().getShopNameSnapshot();

        return SubOrderPickupManifestResponse.builder()
                .subOrderId(subOrder.getId())
                .subOrderNumber(subOrder.getSubOrderNumber())
                .orderNumber(subOrder.getOrder().getOrderNumber())
                .shopId(subOrder.getShopId())
                .shopName(shopName)
                .subtotal(subOrder.getSubtotal())
                .totalItemCount(totalItemCount)
                .items(items)
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
                BigDecimal currentPrice = listing.effectivePrice() != null
                        ? listing.effectivePrice()
                        : effectivePrice(listing.price(), listing.discountPrice());
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
        BigDecimal promoDiscount = cart.promoDiscount() == null ? BigDecimal.ZERO : cart.promoDiscount();
        BigDecimal payableSubtotal = cart.payableSubtotal() != null
                ? cart.payableSubtotal()
                : cart.itemsSubtotal().subtract(promoDiscount).max(BigDecimal.ZERO);
        BigDecimal grossTotal = payableSubtotal.add(deliveryFee);

        BigDecimal walletBalance = paymentClient.getWalletBalance(buyerId);
        BigDecimal storeCreditApplied = walletBalance.min(grossTotal).max(BigDecimal.ZERO);
        BigDecimal totalAmount = grossTotal.subtract(storeCreditApplied);

        boolean isCod = request.getPaymentMethod() == PaymentMethod.COD;
        // Fully covered by store credit → treat as placed/paid with no COD/online charge.
        boolean fullyCoveredByCredit = storeCreditApplied.compareTo(grossTotal) >= 0 && grossTotal.compareTo(BigDecimal.ZERO) > 0;
        OrderStatus orderStatus = (isCod || fullyCoveredByCredit) ? OrderStatus.PLACED : OrderStatus.PAYMENT_PENDING;
        PaymentStatus paymentStatus = (isCod || fullyCoveredByCredit) ? PaymentStatus.PAID : PaymentStatus.PENDING;

        Order order = Order.builder()
                .orderNumber(orderNumber)
                .townId(request.getTownId())
                .buyerId(buyerId)
                .cartId(request.getCartId())
                .status(orderStatus)
                .paymentMethod(request.getPaymentMethod())
                .paymentStatus(paymentStatus)
                .itemsSubtotal(cart.itemsSubtotal())
                .promoCode(cart.promoCode())
                .promoDiscount(promoDiscount)
                .deliveryFee(deliveryFee)
                .storeCreditApplied(storeCreditApplied)
                .totalAmount(totalAmount)
                .deliveryAddressSnapshot(addressSnapshot)
                .buyerPhoneSnapshot(buyerPhone)
                .placedAt((isCod || fullyCoveredByCredit) ? Instant.now() : null)
                .build();

        buildVendorSubOrders(order, cart);
        orderRepository.save(order);

        if (storeCreditApplied.compareTo(BigDecimal.ZERO) > 0) {
            paymentClient.debitWallet(
                    buyerId,
                    storeCreditApplied,
                    "ORDER_CHECKOUT",
                    order.getId(),
                    order.getId(),
                    "Store credit applied on order " + order.getOrderNumber());
        }

        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .toStatus(orderStatus.name())
                .changedBy(buyerId)
                .changedByRole("BUYER")
                .note(storeCreditApplied.compareTo(BigDecimal.ZERO) > 0
                        ? "Order created; store credit " + storeCreditApplied.toPlainString()
                        : "Order created")
                .build());

        cartClient.convertCart(request.getCartId(), buyerId, request.getTownId());

        PaymentInfoResponse paymentInfo = null;
        if (!isCod && !fullyCoveredByCredit) {
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

        if (isCod || fullyCoveredByCredit) {
            notificationClient.notifyOrderPlaced(
                    order.getTownId(), order.getId(), buyerId, buyerPhone,
                    order.getOrderNumber(), order.getTotalAmount());
        }
        return response;
    }

    private void buildVendorSubOrders(Order order, CartClient.CartSnapshot cart) {
        List<List<CartClient.CartItemSnapshot>> groups = cart.items().stream()
                .collect(Collectors.groupingBy(item -> item.vendorId() + ":" + item.shopId()))
                .entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .toList();
        int total = groups.size();

        for (int i = 0; i < groups.size(); i++) {
            List<CartClient.CartItemSnapshot> groupItems = groups.get(i);
            CartClient.CartItemSnapshot first = groupItems.getFirst();
            BigDecimal subtotal = groupItems.stream()
                    .map(CartClient.CartItemSnapshot::lineTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            VendorSubOrder subOrder = VendorSubOrder.builder()
                    .order(order)
                    .vendorId(first.vendorId())
                    .shopId(first.shopId())
                    .subOrderNumber(OrderNumberGenerator.subOrderNumber(order.getOrderNumber(), i + 1, total))
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
                        .unitCodeSnapshot(item.unitCode())
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
                .paymentMethod(order.getPaymentMethod())
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
                        .orderItemId(item.getId())
                        .name(item.getItemNameSnapshot())
                        .shopName(item.getShopNameSnapshot())
                        .unitCode(item.getUnitCodeSnapshot())
                        .quantity(item.getQuantity())
                        .lineTotal(item.getLineTotal())
                        .status(item.getStatus() == null ? OrderItemStatus.ACTIVE : item.getStatus())
                        .cancelReason(item.getCancelReason())
                        .cancelledAt(item.getCancelledAt())
                        .storeCreditAmount(item.getStoreCreditAmount())
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
                .storeCreditApplied(order.getStoreCreditApplied() == null ? BigDecimal.ZERO : order.getStoreCreditApplied())
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
