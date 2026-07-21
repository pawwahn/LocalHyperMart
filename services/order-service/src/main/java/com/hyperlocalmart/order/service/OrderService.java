package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.AddressClient;
import com.hyperlocalmart.order.client.CartClient;
import com.hyperlocalmart.order.client.CatalogClient;
import com.hyperlocalmart.order.client.DeliveryClient;
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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
    private final DeliveryClient deliveryClient;

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
        List<DeliveryClient.OrderAssignment> assignments = deliveryClient.getAssignmentsForOrder(order.getId());
        return OrderDetailResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .status(order.getStatus())
                .displayStatus(buyerDisplayStatus(order, assignments))
                .placedAt(order.getPlacedAt())
                .itemsSubtotal(order.getItemsSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .storeCreditApplied(order.getStoreCreditApplied() == null ? BigDecimal.ZERO : order.getStoreCreditApplied())
                .totalAmount(order.getTotalAmount())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .deliveryAddress(order.getDeliveryAddressSnapshot())
                .items(items)
                .invoicePdfUrl(orderInvoiceService.invoicePdfUrl(order))
                .timeline(buildTimeline(order, assignments))
                .build();
    }

    private List<OrderTimelineStepResponse> buildTimeline(
            Order order, List<DeliveryClient.OrderAssignment> assignments) {
        OrderStatus status = order.getStatus();
        List<VendorSubOrder> subs = order.getVendorSubOrders() == null ? List.of() : order.getVendorSubOrders();
        List<VendorSubOrder> activeSubs = subs.stream()
                .filter(s -> s.getStatus() != VendorSubOrderStatus.VENDOR_REJECTED)
                .toList();

        Instant placedAt = order.getPlacedAt();
        Instant readyAt = activeSubs.stream()
                .map(VendorSubOrder::getReadyForPickupAt)
                .filter(Objects::nonNull)
                .min(Instant::compareTo)
                .orElse(null);
        Instant deliveredAt = order.getDeliveredAt();
        Instant cancelledAt = order.getCancelledAt();

        boolean anyReady = activeSubs.stream()
                .anyMatch(s -> s.getStatus() == VendorSubOrderStatus.READY_FOR_PICKUP
                        || s.getStatus() == VendorSubOrderStatus.DELIVERED);
        boolean allReady = !activeSubs.isEmpty() && activeSubs.stream()
                .allMatch(s -> s.getStatus() == VendorSubOrderStatus.READY_FOR_PICKUP
                        || s.getStatus() == VendorSubOrderStatus.DELIVERED);

        Instant pickedFromShopAt = firstEventAt(assignments, "PICKED_FROM_VENDOR");
        Instant atHubAt = firstEventAt(assignments, "BROUGHT_TO_HUB");
        Instant lastMileAssignedAt = firstEventAt(assignments, "LAST_MILE_ASSIGNED");
        Instant leftHubAt = firstEventAt(assignments, "PICKED_FROM_HUB");
        Instant deliveredEventAt = firstEventAt(assignments, "DELIVERED");
        if (deliveredAt == null) {
            deliveredAt = deliveredEventAt;
        }

        boolean pickedFromShop = pickedFromShopAt != null;
        boolean atHub = atHubAt != null || hasCompletedPickupLeg(assignments);
        boolean agentAssigned = lastMileAssignedAt != null;
        boolean leftHub = leftHubAt != null || hasInProgressOrCompletedLastMile(assignments);
        boolean delivered = status == OrderStatus.DELIVERED || deliveredEventAt != null;

        List<OrderTimelineStepResponse> steps = new ArrayList<>();

        if (status == OrderStatus.PAYMENT_PENDING) {
            steps.add(step("PAYMENT_PENDING", "Awaiting payment", "CURRENT", null, null));
            appendHappyPathSkeleton(steps);
            return steps;
        }

        if (status == OrderStatus.PAYMENT_FAILED) {
            steps.add(step("PAYMENT_FAILED", "Payment failed", "CURRENT", null, "Try placing the order again"));
            return steps;
        }

        if (status == OrderStatus.CANCELLED) {
            steps.add(step("ORDER_PLACED", "Order placed", "DONE", placedAt, null));
            steps.add(step("CANCELLED", "Cancelled", "CURRENT", cancelledAt,
                    order.getCancelReason() != null ? order.getCancelReason() : null));
            return steps;
        }

        steps.add(step("ORDER_PLACED", "Order placed", "DONE", placedAt, null));

        String preparingState = stateAfter(true, delivered || allReady || anyReady || pickedFromShop || atHub);
        steps.add(step("SHOP_PREPARING", "Shop is preparing", preparingState, placedAt,
                "CURRENT".equals(preparingState)
                        ? (subs.size() > 1 ? "Waiting for shops to confirm" : "Waiting for the shop to confirm")
                        : null));

        String readyState = stateAfter(
                "DONE".equals(preparingState),
                delivered || allReady || pickedFromShop || atHub || agentAssigned || leftHub);
        String readyNote = null;
        if ("CURRENT".equals(readyState) && activeSubs.size() > 1 && !allReady) {
            long readyCount = activeSubs.stream()
                    .filter(s -> s.getStatus() == VendorSubOrderStatus.READY_FOR_PICKUP
                            || s.getStatus() == VendorSubOrderStatus.DELIVERED)
                    .count();
            readyNote = readyCount + " of " + activeSubs.size() + " shops ready";
        } else if ("CURRENT".equals(readyState)) {
            readyNote = "Waiting for pickup agent at the shop";
        }
        steps.add(step("READY_AT_SHOP", "Ready at shop", readyState, readyAt, readyNote));

        String pickedShopState = stateAfter(
                "DONE".equals(readyState),
                delivered || pickedFromShop || atHub || agentAssigned || leftHub);
        steps.add(step("PICKED_FROM_SHOP", "Picked up from shop", pickedShopState, pickedFromShopAt,
                "CURRENT".equals(pickedShopState) ? "Agent is bringing your order to the delivery hub" : null));

        String hubState = stateAfter(
                "DONE".equals(pickedShopState),
                delivered || atHub || agentAssigned || leftHub);
        steps.add(step("AT_HUB", "Arrived at delivery hub", hubState, atHubAt,
                "CURRENT".equals(hubState) ? "Hub received and checked your order" : null));

        String assignState = stateAfter(
                "DONE".equals(hubState),
                delivered || agentAssigned || leftHub);
        steps.add(step("AGENT_ASSIGNED", "Delivery agent assigned", assignState, lastMileAssignedAt,
                "CURRENT".equals(assignState) ? "Waiting for the agent to leave the hub" : null));

        String outState;
        if (delivered) {
            outState = "DONE";
        } else if (leftHub) {
            outState = "CURRENT";
        } else {
            outState = stateAfter("DONE".equals(assignState), false);
        }
        steps.add(step("OUT_FOR_DELIVERY", "Out for delivery", outState, leftHubAt,
                "CURRENT".equals(outState) ? "Agent left the hub — on the way to you" : null));

        steps.add(step("DELIVERED", "Delivered",
                delivered ? "DONE" : "UPCOMING",
                deliveredAt,
                null));

        return normalizeCurrent(steps);
    }

    private void appendHappyPathSkeleton(List<OrderTimelineStepResponse> steps) {
        steps.add(step("ORDER_PLACED", "Order placed", "UPCOMING", null, null));
        steps.add(step("SHOP_PREPARING", "Shop is preparing", "UPCOMING", null, null));
        steps.add(step("READY_AT_SHOP", "Ready at shop", "UPCOMING", null, null));
        steps.add(step("PICKED_FROM_SHOP", "Picked up from shop", "UPCOMING", null, null));
        steps.add(step("AT_HUB", "Arrived at delivery hub", "UPCOMING", null, null));
        steps.add(step("AGENT_ASSIGNED", "Delivery agent assigned", "UPCOMING", null, null));
        steps.add(step("OUT_FOR_DELIVERY", "Out for delivery", "UPCOMING", null, null));
        steps.add(step("DELIVERED", "Delivered", "UPCOMING", null, null));
    }

    /** DONE if done; else CURRENT if previousDone; else UPCOMING. */
    private String stateAfter(boolean previousDone, boolean done) {
        if (done) return "DONE";
        if (previousDone) return "CURRENT";
        return "UPCOMING";
    }

    private List<OrderTimelineStepResponse> normalizeCurrent(List<OrderTimelineStepResponse> steps) {
        // Ensure exactly one CURRENT when order is in progress (last DONE's next UPCOMING).
        boolean hasCurrent = steps.stream().anyMatch(s -> "CURRENT".equals(s.getState()));
        if (hasCurrent) return steps;
        boolean sawDone = false;
        for (int i = 0; i < steps.size(); i++) {
            OrderTimelineStepResponse s = steps.get(i);
            if ("DONE".equals(s.getState())) {
                sawDone = true;
                continue;
            }
            if (sawDone && "UPCOMING".equals(s.getState())) {
                steps.set(i, step(s.getCode(), s.getLabel(), "CURRENT", s.getAt(), s.getNote()));
                break;
            }
        }
        return steps;
    }

    private Instant firstEventAt(List<DeliveryClient.OrderAssignment> assignments, String eventType) {
        if (assignments == null || assignments.isEmpty()) return null;
        return assignments.stream()
                .flatMap(a -> a.events() == null ? Stream.empty() : a.events().stream())
                .filter(e -> eventType.equalsIgnoreCase(e.eventType()))
                .map(DeliveryClient.OrderAssignmentEvent::createdAt)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
    }

    private boolean hasCompletedPickupLeg(List<DeliveryClient.OrderAssignment> assignments) {
        if (assignments == null) return false;
        return assignments.stream()
                .anyMatch(a -> "PICKUP".equalsIgnoreCase(a.legType())
                        && "COMPLETED".equalsIgnoreCase(a.status()));
    }

    private boolean hasInProgressOrCompletedLastMile(List<DeliveryClient.OrderAssignment> assignments) {
        if (assignments == null) return false;
        return assignments.stream()
                .anyMatch(a -> "LAST_MILE".equalsIgnoreCase(a.legType())
                        && ("IN_PROGRESS".equalsIgnoreCase(a.status())
                        || "COMPLETED".equalsIgnoreCase(a.status())));
    }

    private String buyerDisplayStatus(Order order, List<DeliveryClient.OrderAssignment> assignments) {
        OrderStatus status = order.getStatus();
        if (status == OrderStatus.PAYMENT_PENDING) return "Awaiting Payment";
        if (status == OrderStatus.PAYMENT_FAILED) return "Payment Failed";
        if (status == OrderStatus.CANCELLED) return "Cancelled";
        if (status == OrderStatus.DELIVERED || firstEventAt(assignments, "DELIVERED") != null) {
            return "Delivered";
        }
        if (firstEventAt(assignments, "PICKED_FROM_HUB") != null
                || hasInProgressOrCompletedLastMile(assignments)) {
            return "Out for Delivery";
        }
        if (firstEventAt(assignments, "LAST_MILE_ASSIGNED") != null) {
            return "Agent Assigned";
        }
        if (firstEventAt(assignments, "BROUGHT_TO_HUB") != null || hasCompletedPickupLeg(assignments)) {
            return "At Delivery Hub";
        }
        if (firstEventAt(assignments, "PICKED_FROM_VENDOR") != null) {
            return "Picked from Shop";
        }
        List<VendorSubOrder> activeSubs = order.getVendorSubOrders() == null
                ? List.of()
                : order.getVendorSubOrders().stream()
                .filter(s -> s.getStatus() != VendorSubOrderStatus.VENDOR_REJECTED)
                .toList();
        boolean allReady = !activeSubs.isEmpty() && activeSubs.stream()
                .allMatch(s -> s.getStatus() == VendorSubOrderStatus.READY_FOR_PICKUP
                        || s.getStatus() == VendorSubOrderStatus.DELIVERED);
        if (allReady) return "Ready at Shop";
        if (status == OrderStatus.PLACED) return "Shop Preparing";
        return displayStatus(status);
    }

    private OrderTimelineStepResponse step(String code, String label, String state, Instant at, String note) {
        return OrderTimelineStepResponse.builder()
                .code(code)
                .label(label)
                .state(state)
                .at(at)
                .note(note)
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
