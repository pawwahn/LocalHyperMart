package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.common.tax.GstLineTaxBreakdown;
import com.hyperlocalmart.common.tax.GstTaxCalculator;
import com.hyperlocalmart.order.client.AddressClient;
import com.hyperlocalmart.order.client.CartClient;
import com.hyperlocalmart.order.client.CatalogClient;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.client.UserReferralClient;
import com.hyperlocalmart.order.config.CheckoutProperties;
import com.hyperlocalmart.order.dto.request.CreateOrderRequest;
import com.hyperlocalmart.order.dto.request.DeliverOrderRequest;
import com.hyperlocalmart.order.dto.request.PaymentCallbackRequest;
import com.hyperlocalmart.order.dto.response.*;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderStatusHistoryRepository;
import com.hyperlocalmart.order.repository.ProductRatingRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
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
    private final ProductRatingRepository productRatingRepository;
    private final DeliveryAgentRatingService deliveryAgentRatingService;
    private final ScratchCardService scratchCardService;
    private final UserReferralClient userReferralClient;
    private final PlatformTransactionManager transactionManager;

    @Transactional(readOnly = true)
    public boolean buyerHasDeliveredOrder(UUID buyerId) {
        return orderRepository.existsByBuyerIdAndStatus(buyerId, OrderStatus.DELIVERED);
    }

    /**
     * Not @Transactional end-to-end: cart/payment/notification HTTP must run after the order row is committed,
     * otherwise payment-service and internal order reads block on an open transaction (pool exhaustion / stuck checkout).
     */
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
        List<UUID> ids = orders.getContent().stream().map(Order::getId).toList();
        Map<UUID, Integer> itemCounts = ids.isEmpty()
                ? Map.of()
                : orderRepository.sumActiveQtyByOrderId(ids).stream().collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> ((Number) row[1]).intValue(),
                        (a, b) -> a));
        List<OrderSummaryResponse> items = orders.getContent().stream()
                .map(order -> toSummary(order, itemCounts.getOrDefault(order.getId(), 0)))
                .toList();
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
                .orderNumber(order.getOrderNumber())
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .totalAmount(buyerPayableTotal(order))
                .buyerPhone(order.getBuyerPhoneSnapshot())
                .build();
    }

    @Transactional(readOnly = true)
    public SubOrderInternalSnapshotResponse getSubOrderSnapshot(UUID subOrderId) {
        VendorSubOrder subOrder = vendorSubOrderRepository.findDetailedByIdWithItems(subOrderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Sub-order not found"));
        String shopName = "Shop";
        if (subOrder.getItems() != null && !subOrder.getItems().isEmpty()) {
            String snap = subOrder.getItems().getFirst().getShopNameSnapshot();
            if (snap != null && !snap.isBlank()) {
                shopName = snap;
            }
        }
        return SubOrderInternalSnapshotResponse.builder()
                .subOrderId(subOrder.getId())
                .subOrderNumber(subOrder.getSubOrderNumber())
                .orderId(subOrder.getOrder().getId())
                .townId(subOrder.getOrder().getTownId())
                .vendorId(subOrder.getVendorId())
                .shopId(subOrder.getShopId())
                .shopName(shopName)
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
    public OrderDeliveryManifestResponse getDeliveryManifest(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        List<VendorSubOrder> subOrders = vendorSubOrderRepository.findByOrderIdWithItems(orderId);
        List<DeliveryManifestLineResponse> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (VendorSubOrder subOrder : subOrders) {
            if (subOrder.getStatus() == VendorSubOrderStatus.VENDOR_REJECTED) {
                continue;
            }
            String shopName = subOrder.getItems().isEmpty()
                    ? "Shop"
                    : java.util.Optional.ofNullable(subOrder.getItems().getFirst().getShopNameSnapshot()).orElse("Shop");
            for (OrderItem item : subOrder.getItems()) {
                if (item.getStatus() == OrderItemStatus.CANCELLED) {
                    continue;
                }
                lines.add(DeliveryManifestLineResponse.builder()
                        .shopName(shopName)
                        .name(item.getItemNameSnapshot())
                        .quantity(item.getQuantity())
                        .unitCode(item.getUnitCodeSnapshot())
                        .lineTotal(item.getLineTotal())
                        .build());
                if (item.getLineTotal() != null) {
                    subtotal = subtotal.add(item.getLineTotal());
                }
            }
        }
        int totalItemCount = lines.stream().mapToInt(DeliveryManifestLineResponse::getQuantity).sum();
        BigDecimal collectCash = order.getPaymentMethod() == PaymentMethod.COD ? buyerPayableTotal(order) : null;
        return OrderDeliveryManifestResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .paymentMethod(order.getPaymentMethod())
                .collectCashAmount(collectCash)
                .subtotal(subtotal)
                .totalItemCount(totalItemCount)
                .items(lines)
                .build();
    }

    @Transactional(readOnly = true)
    public OrderDeliveryInfoResponse getDeliveryInfo(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        Map<String, Object> addr = order.getDeliveryAddressSnapshot();
        return OrderDeliveryInfoResponse.builder()
                .orderId(order.getId())
                .buyerId(order.getBuyerId())
                .townId(order.getTownId())
                .status(order.getStatus().name())
                .orderNumber(order.getOrderNumber())
                .buyerPhone(order.getBuyerPhoneSnapshot())
                .recipientName(stringVal(addr, "recipientName"))
                .recipientPhone(stringVal(addr, "recipientPhone"))
                .addressLine1(stringVal(addr, "line1"))
                .addressLine2(stringVal(addr, "line2"))
                .landmark(stringVal(addr, "landmark"))
                .pincode(stringVal(addr, "pincode"))
                .addressLabel(stringVal(addr, "label"))
                .vendorAgentDelivery(order.isVendorAgentDelivery())
                .paymentMethod(order.getPaymentMethod())
                .collectCashAmount(
                        order.getPaymentMethod() == PaymentMethod.COD ? buyerPayableTotal(order) : null)
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
        // COD: cash collected at door — mark paid now (was PENDING from placement).
        if (order.getPaymentMethod() == PaymentMethod.COD
                && order.getPaymentStatus() == PaymentStatus.PENDING) {
            order.setPaymentStatus(PaymentStatus.PAID);
        }
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
        try {
            scratchCardService.issueIfEligible(order);
        } catch (Exception ex) {
            log.warn("Scratch card not issued for order {}: {}", order.getId(), ex.getMessage());
        }
        try {
            userReferralClient.onOrderDelivered(order.getBuyerId(), order.getId());
        } catch (Exception ex) {
            log.warn("Referral reward not processed for order {}: {}", order.getId(), ex.getMessage());
        }
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
        notificationClient.notifyPaymentFailed(
                order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                order.getOrderNumber());
    }

    @Transactional
    public PaymentInfoResponse retryPayment(UUID buyerId, UUID orderId, String idempotencyKey) {
        Order order = orderRepository.findByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        if (order.getPaymentMethod() != PaymentMethod.ONLINE) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Order is not an online payment order");
        }
        if (order.getStatus() != OrderStatus.PAYMENT_PENDING && order.getStatus() != OrderStatus.PAYMENT_FAILED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order is not awaiting payment");
        }
        PaymentInfoResponse payment = paymentClient.initiatePayment(
                buyerId, order.getId(), order.getTownId(), "RAZORPAY",
                idempotencyKey, order.getBuyerPhoneSnapshot(),
                order.getTotalAmount(), order.getOrderNumber(), order.getStatus().name(), "ONLINE");
        if (order.getStatus() == OrderStatus.PAYMENT_FAILED) {
            order.setStatus(OrderStatus.PAYMENT_PENDING);
            order.setPaymentStatus(PaymentStatus.PENDING);
            orderRepository.save(order);
        }
        return payment;
    }

    private CreateOrderResponse createOrderInternal(UUID buyerId, String buyerPhone, String idempotencyKey, CreateOrderRequest request) {
        CartClient.CartSnapshot cart = cartClient.getCart(request.getCartId(), buyerId, request.getTownId());
        Map<String, Object> addressSnapshot = addressClient.getAddressSnapshot(request.getAddressId(), buyerId, request.getTownId());
        TownClient.TownSummary town = townClient.getTownSummary(request.getTownId());

        String orderNumber = orderNumberGenerator.nextOrderNumber(request.getTownId(), town.townCode(), town.stateCode());
        BigDecimal promoDiscount = cart.promoDiscount() == null ? BigDecimal.ZERO : cart.promoDiscount();
        BigDecimal payableSubtotal = cart.payableSubtotal() != null
                ? cart.payableSubtotal()
                : cart.itemsSubtotal().subtract(promoDiscount).max(BigDecimal.ZERO);
        TownClient.CheckoutFees fees = townClient.resolveTownCheckoutFees(request.getTownId(), payableSubtotal);
        BigDecimal configuredFee = fees.deliveryFee();
        if (configuredFee == null) {
            configuredFee = townClient.getPlatformDeliveryFee();
        }
        BigDecimal deliveryFee = configuredFee != null ? configuredFee : checkoutProperties.getDeliveryFee();
        BigDecimal platformFee = fees.platformFee() == null ? BigDecimal.ZERO : fees.platformFee();
        TownClient.PaymentSettings paySettings = townClient.getPaymentSettings(request.getTownId());
        boolean isCod = request.getPaymentMethod() == PaymentMethod.COD;
        if (isCod && !paySettings.codEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cash on delivery is not available in this town");
        }
        if (!isCod && !paySettings.upiEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Online payment is not available in this town");
        }
        BigDecimal codFee = isCod ? paySettings.codCharge() : BigDecimal.ZERO;
        boolean membershipCreditUsed = false;
        UUID persistedOrderId = null;
        try {
        CheckoutTotals totals = totalsFor(
                payableSubtotal, deliveryFee, platformFee, codFee, request.isUseStoreCredit(), buyerId);

        Order order = Order.builder()
                .orderNumber(orderNumber)
                .townId(request.getTownId())
                .buyerId(buyerId)
                .cartId(request.getCartId())
                .status(totals.orderStatus(isCod))
                .paymentMethod(request.getPaymentMethod())
                .paymentStatus(totals.paymentStatus())
                .itemsSubtotal(cart.itemsSubtotal())
                .promoCode(cart.promoCode())
                .promoDiscount(promoDiscount)
                .deliveryFee(deliveryFee)
                .platformFee(platformFee)
                .codFee(codFee)
                .storeCreditApplied(totals.storeCreditApplied())
                .membershipCreditUsed(false)
                .membershipDeliveryWaived(BigDecimal.ZERO)
                .totalAmount(totals.totalAmount())
                .deliveryAddressSnapshot(addressSnapshot)
                .buyerPhoneSnapshot(buyerPhone)
                .placedAt(totals.placedAt(isCod))
                .build();

        buildVendorSubOrders(order, cart);
        order.setTaxAmount(sumOrderLineTax(order));
        inWriteTransaction(() -> orderRepository.saveAndFlush(order));
        persistedOrderId = order.getId();

        if (deliveryFee.compareTo(BigDecimal.ZERO) > 0) {
            PaymentClient.ConsumeMembershipResult consume =
                    paymentClient.tryConsumeMembership(buyerId, order.getId(), deliveryFee);
            if (consume != null && consume.applied()) {
                membershipCreditUsed = true;
                BigDecimal waived = consume.waivedAmount() == null ? deliveryFee : consume.waivedAmount();
                deliveryFee = BigDecimal.ZERO;
                totals = totalsFor(
                        payableSubtotal, deliveryFee, platformFee, codFee, request.isUseStoreCredit(), buyerId);
                order.setDeliveryFee(deliveryFee);
                order.setMembershipCreditUsed(true);
                order.setMembershipDeliveryWaived(waived);
                order.setStoreCreditApplied(totals.storeCreditApplied());
                order.setTotalAmount(totals.totalAmount());
                order.setStatus(totals.orderStatus(isCod));
                order.setPaymentStatus(totals.paymentStatus());
                order.setPlacedAt(totals.placedAt(isCod));
                inWriteTransaction(() -> orderRepository.saveAndFlush(order));
            }
        }

        if (totals.storeCreditApplied().compareTo(BigDecimal.ZERO) > 0) {
            paymentClient.debitWallet(
                    buyerId,
                    totals.storeCreditApplied(),
                    "ORDER_CHECKOUT",
                    order.getId(),
                    order.getId(),
                    "Store credit applied on order " + order.getOrderNumber());
        }

        CheckoutTotals totalsForHistory = totals;
        inWriteTransaction(() -> orderStatusHistoryRepository.saveAndFlush(OrderStatusHistory.builder()
                .orderId(order.getId())
                .toStatus(order.getStatus().name())
                .changedBy(buyerId)
                .changedByRole("BUYER")
                .note(totalsForHistory.storeCreditApplied().compareTo(BigDecimal.ZERO) > 0
                        ? "Order created; store credit " + totalsForHistory.storeCreditApplied().toPlainString()
                        : "Order created")
                .build()));

        cartClient.convertCart(request.getCartId(), buyerId, request.getTownId());

        PaymentInfoResponse paymentInfo = null;
        boolean fullyCoveredByCredit = totals.fullyCovered();
        if (!isCod && !fullyCoveredByCredit) {
            paymentInfo = paymentClient.initiatePayment(
                    buyerId, order.getId(), request.getTownId(), request.getPaymentGateway(),
                    idempotencyKey + "-pay", buyerPhone,
                    order.getTotalAmount(), order.getOrderNumber(), order.getStatus().name(), "ONLINE");
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
            final UUID notifyTownId = order.getTownId();
            final UUID notifyOrderId = order.getId();
            final String notifyNumber = order.getOrderNumber();
            final BigDecimal notifyTotal = order.getTotalAmount();
            CompletableFuture.runAsync(() -> {
                try {
                    notificationClient.notifyOrderPlaced(
                            notifyTownId, notifyOrderId, buyerId, buyerPhone, notifyNumber, notifyTotal);
                } catch (Exception ex) {
                    log.warn("Order placed notification failed for {}: {}", notifyNumber, ex.getMessage());
                }
            });
        }
        return response;
        } catch (RuntimeException ex) {
            if (membershipCreditUsed && persistedOrderId != null) {
                paymentClient.restoreMembershipCredit(buyerId, persistedOrderId, "Order create failed");
            }
            throw ex;
        }
    }

    /** Matches checkout math using persisted order fee columns (after line cancels). */
    static BigDecimal buyerPayableTotal(Order order) {
        if (order == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal items = order.getItemsSubtotal() == null ? BigDecimal.ZERO : order.getItemsSubtotal();
        BigDecimal promo = order.getPromoDiscount() == null ? BigDecimal.ZERO : order.getPromoDiscount();
        BigDecimal payableItems = items.subtract(promo).max(BigDecimal.ZERO);
        BigDecimal delivery = order.getDeliveryFee() == null ? BigDecimal.ZERO : order.getDeliveryFee();
        BigDecimal platform = order.getPlatformFee() == null ? BigDecimal.ZERO : order.getPlatformFee();
        BigDecimal cod = order.getCodFee() == null ? BigDecimal.ZERO : order.getCodFee();
        BigDecimal credit = order.getStoreCreditApplied() == null ? BigDecimal.ZERO : order.getStoreCreditApplied();
        return payableItems.add(delivery).add(platform).add(cod).subtract(credit).max(BigDecimal.ZERO);
    }

    private CheckoutTotals totalsFor(
            BigDecimal payableSubtotal,
            BigDecimal deliveryFee,
            BigDecimal platformFee,
            BigDecimal codFee,
            boolean useStoreCredit,
            UUID buyerId) {
        BigDecimal safeCod = codFee == null ? BigDecimal.ZERO : codFee.max(BigDecimal.ZERO);
        BigDecimal grossTotal = payableSubtotal.add(deliveryFee).add(platformFee).add(safeCod);
        BigDecimal walletBalance = useStoreCredit
                ? paymentClient.getWalletBalance(buyerId)
                : BigDecimal.ZERO;
        BigDecimal storeCreditApplied = walletBalance.min(grossTotal).max(BigDecimal.ZERO);
        BigDecimal totalAmount = grossTotal.subtract(storeCreditApplied);
        boolean fullyCovered = storeCreditApplied.compareTo(grossTotal) >= 0 && grossTotal.compareTo(BigDecimal.ZERO) > 0;
        return new CheckoutTotals(grossTotal, storeCreditApplied, totalAmount, fullyCovered);
    }

    private record CheckoutTotals(
            BigDecimal grossTotal,
            BigDecimal storeCreditApplied,
            BigDecimal totalAmount,
            boolean fullyCovered
    ) {
        OrderStatus orderStatus(boolean isCod) {
            return (isCod || fullyCovered) ? OrderStatus.PLACED : OrderStatus.PAYMENT_PENDING;
        }

        PaymentStatus paymentStatus() {
            return fullyCovered ? PaymentStatus.PAID : PaymentStatus.PENDING;
        }

        Instant placedAt(boolean isCod) {
            return (isCod || fullyCovered) ? Instant.now() : null;
        }
    }

    private void inWriteTransaction(Runnable work) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> work.run());
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
                OrderItem line = OrderItem.builder()
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
                        .build();
                applyTaxSnapshot(line, item);
                subOrder.getItems().add(line);
            }
            order.getVendorSubOrders().add(subOrder);
        }
    }

    private static BigDecimal sumOrderLineTax(Order order) {
        BigDecimal total = BigDecimal.ZERO;
        for (VendorSubOrder sub : order.getVendorSubOrders()) {
            for (OrderItem item : sub.getItems()) {
                if (item.getLineTaxTotal() != null) {
                    total = total.add(item.getLineTaxTotal());
                }
            }
        }
        return total;
    }

    private static void applyTaxSnapshot(OrderItem line, CartClient.CartItemSnapshot item) {
        if (item.hsnCode() == null || item.hsnCode().isBlank()) {
            return;
        }
        GstLineTaxBreakdown tax = GstTaxCalculator.computeLineTax(
                item.hsnCode(),
                item.gstPercent(),
                item.cessPercent(),
                item.priceIncludesTax(),
                item.countryOfOrigin(),
                line.getLineTotal());
        line.setHsnCodeSnapshot(tax.getHsnCode());
        line.setGstPercentSnapshot(tax.getGstPercent());
        line.setCessPercentSnapshot(tax.getCessPercent());
        line.setPriceIncludesTaxSnapshot(tax.isPriceIncludesTax());
        line.setCountryOfOriginSnapshot(tax.getCountryOfOrigin());
        line.setTaxableValue(tax.getTaxableValue());
        line.setCgstAmount(tax.getCgstAmount());
        line.setSgstAmount(tax.getSgstAmount());
        line.setIgstAmount(tax.getIgstAmount());
        line.setCessAmount(tax.getCessAmount());
        line.setLineTaxTotal(tax.getTotalTaxAmount());
    }

    private OrderSummaryResponse toSummary(Order order) {
        int itemCount = order.getVendorSubOrders() == null
                ? 0
                : order.getVendorSubOrders().stream()
                        .flatMap(sub -> sub.getItems().stream())
                        .filter(OrderItem::isActiveLine)
                        .mapToInt(OrderItem::getQuantity)
                        .sum();
        return toSummary(order, itemCount);
    }

    private OrderSummaryResponse toSummary(Order order, int itemCount) {
        return OrderSummaryResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .status(order.getStatus())
                .displayStatus(displayStatus(order.getStatus()))
                .totalAmount(buyerPayableTotal(order))
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .placedAt(order.getPlacedAt())
                .itemCount(itemCount)
                .build();
    }

    private OrderDetailResponse toDetail(Order order) {
        List<OrderItemDetailResponse> items = new ArrayList<>();
        boolean orderPlaced = order.getStatus() == OrderStatus.PLACED;
        boolean unpaidCancellable = order.getStatus() == OrderStatus.PAYMENT_PENDING
                || order.getStatus() == OrderStatus.PAYMENT_FAILED;
        boolean anyShopPastPlaced = order.getVendorSubOrders() != null && order.getVendorSubOrders().stream()
                .anyMatch(s -> s.getStatus() != VendorSubOrderStatus.PLACED
                        && s.getStatus() != VendorSubOrderStatus.VENDOR_REJECTED);
        boolean hasActiveItems = false;

        List<UUID> itemIds = order.getVendorSubOrders() == null ? List.of() : order.getVendorSubOrders().stream()
                .flatMap(s -> s.getItems().stream())
                .map(OrderItem::getId)
                .toList();
        Map<UUID, ProductRating> ratingsByItem = itemIds.isEmpty()
                ? Map.of()
                : productRatingRepository.findByOrderItemIdIn(itemIds).stream()
                        .collect(Collectors.toMap(ProductRating::getOrderItemId, r -> r, (a, b) -> a));

        for (VendorSubOrder subOrder : order.getVendorSubOrders()) {
            boolean subCancellable = orderPlaced && subOrder.getStatus() == VendorSubOrderStatus.PLACED;
            for (OrderItem item : subOrder.getItems()) {
                OrderItemStatus itemStatus = item.getStatus() == null ? OrderItemStatus.ACTIVE : item.getStatus();
                boolean active = itemStatus == OrderItemStatus.ACTIVE;
                if (active) {
                    hasActiveItems = true;
                }
                boolean claimable = order.getStatus() == OrderStatus.DELIVERED
                        && OrderClaimService.withinClaimWindow(order)
                        && active;
                ProductRating rating = ratingsByItem.get(item.getId());
                boolean rateable = order.getStatus() == OrderStatus.DELIVERED
                        && ProductRatingService.withinRatingWindow(order)
                        && active;
                items.add(OrderItemDetailResponse.builder()
                        .orderItemId(item.getId())
                        .name(item.getItemNameSnapshot())
                        .shopName(item.getShopNameSnapshot())
                        .unitCode(item.getUnitCodeSnapshot())
                        .quantity(item.getQuantity())
                        .lineTotal(item.getLineTotal())
                        .status(itemStatus)
                        .cancelReason(item.getCancelReason())
                        .cancelledAt(item.getCancelledAt())
                        .storeCreditAmount(item.getStoreCreditAmount())
                        .canCancel(subCancellable && active)
                        .canFileClaim(claimable)
                        .canRate(rateable)
                        .myRating(rating == null ? null : (int) rating.getStars())
                        .build());
            }
        }
        List<DeliveryClient.OrderAssignment> assignments = deliveryClient.getAssignmentsForOrder(order.getId());
        boolean canCancelOrder = (unpaidCancellable && hasActiveItems)
                || (orderPlaced && !anyShopPastPlaced && hasActiveItems);
        boolean canFileClaim = order.getStatus() == OrderStatus.DELIVERED
                && OrderClaimService.withinClaimWindow(order);
        return OrderDetailResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .status(order.getStatus())
                .displayStatus(buyerDisplayStatus(order, assignments))
                .placedAt(order.getPlacedAt())
                .itemsSubtotal(order.getItemsSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .membershipCreditUsed(order.isMembershipCreditUsed())
                .membershipDeliveryWaived(order.getMembershipDeliveryWaived() == null
                        ? BigDecimal.ZERO : order.getMembershipDeliveryWaived())
                .platformFee(order.getPlatformFee() == null ? BigDecimal.ZERO : order.getPlatformFee())
                .codFee(order.getCodFee() == null ? BigDecimal.ZERO : order.getCodFee())
                .storeCreditApplied(order.getStoreCreditApplied() == null ? BigDecimal.ZERO : order.getStoreCreditApplied())
                .totalAmount(buyerPayableTotal(order))
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .deliveryAddress(order.getDeliveryAddressSnapshot())
                .items(items)
                .invoicePdfUrl(orderInvoiceService.invoicePdfUrl(order))
                .timeline(buildTimeline(order, assignments))
                .canCancelOrder(canCancelOrder)
                .canPayOnline(order.getPaymentMethod() == PaymentMethod.ONLINE && unpaidCancellable)
                .canFileClaim(canFileClaim)
                .scratchCard(scratchCardService.findForOrder(order.getBuyerId(), order.getId()).orElse(null))
                .deliveryAgentRating(deliveryAgentRatingService.buyerView(order, assignments))
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

        if (order.isVendorAgentDelivery()) {
            return buildVendorAgentTimeline(
                    order, activeSubs, assignments, status, placedAt, deliveredAt, deliveredEventAt);
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

    private List<OrderTimelineStepResponse> buildVendorAgentTimeline(
            Order order,
            List<VendorSubOrder> activeSubs,
            List<DeliveryClient.OrderAssignment> assignments,
            OrderStatus status,
            Instant placedAt,
            Instant deliveredAt,
            Instant deliveredEventAt) {
        Instant vendorModeAt = activeSubs.stream()
                .map(VendorSubOrder::getVendorAgentDeliveryAt)
                .filter(Objects::nonNull)
                .min(Instant::compareTo)
                .orElse(null);
        Instant assignedAt = firstEventAt(assignments, "VENDOR_DIRECT_ASSIGNED");
        if (assignedAt == null && assignments != null) {
            assignedAt = assignments.stream()
                    .filter(a -> "VENDOR_DIRECT".equalsIgnoreCase(a.legType()))
                    .map(DeliveryClient.OrderAssignment::assignedAt)
                    .filter(Objects::nonNull)
                    .min(Instant::compareTo)
                    .orElse(null);
        }
        Instant pickedAt = firstEventAt(assignments, "VENDOR_DIRECT_PICKED_FROM_SHOP");
        if (deliveredAt == null) {
            deliveredAt = deliveredEventAt;
        }
        boolean delivered = status == OrderStatus.DELIVERED || deliveredEventAt != null;
        boolean agentAssigned = assignedAt != null
                || (assignments != null && assignments.stream()
                        .anyMatch(a -> "VENDOR_DIRECT".equalsIgnoreCase(a.legType())));
        boolean outForDelivery = pickedAt != null || hasVendorDirectInProgress(assignments);

        List<OrderTimelineStepResponse> steps = new ArrayList<>();
        steps.add(step("ORDER_PLACED", "Order placed", "DONE", placedAt, null));

        String preparingState = stateAfter(true, vendorModeAt != null || agentAssigned || outForDelivery || delivered);
        steps.add(step("SHOP_PREPARING", "Shop is preparing", preparingState, placedAt,
                "CURRENT".equals(preparingState) ? "The shop is getting your order ready" : null));

        String assignedState = stateAfter(
                "DONE".equals(preparingState), agentAssigned || outForDelivery || delivered);
        steps.add(step("AGENT_ASSIGNED", "Shop agent assigned", assignedState, assignedAt != null ? assignedAt : vendorModeAt,
                "CURRENT".equals(assignedState) ? "Waiting for the shop to assign their delivery agent" : null));

        String outState;
        if (delivered) {
            outState = "DONE";
        } else if (outForDelivery) {
            outState = "CURRENT";
        } else {
            outState = stateAfter("DONE".equals(assignedState), false);
        }
        steps.add(step("OUT_FOR_DELIVERY", "On the way to you", outState, pickedAt,
                "CURRENT".equals(outState) ? "Your order is on the way" : null));

        steps.add(step("DELIVERED", "Delivered", delivered ? "DONE" : "UPCOMING", deliveredAt, null));
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

    private boolean hasVendorDirectInProgress(List<DeliveryClient.OrderAssignment> assignments) {
        if (assignments == null) {
            return false;
        }
        return assignments.stream()
                .anyMatch(a -> "VENDOR_DIRECT".equalsIgnoreCase(a.legType())
                        && "IN_PROGRESS".equalsIgnoreCase(a.status()));
    }

    private String buyerDisplayStatus(Order order, List<DeliveryClient.OrderAssignment> assignments) {
        OrderStatus status = order.getStatus();
        if (status == OrderStatus.PAYMENT_PENDING) return "Awaiting Payment";
        if (status == OrderStatus.PAYMENT_FAILED) return "Payment Failed";
        if (status == OrderStatus.CANCELLED) return "Cancelled";
        if (order.isVendorAgentDelivery()) {
            if (status == OrderStatus.DELIVERED || firstEventAt(assignments, "DELIVERED") != null) {
                return "Delivered";
            }
            if (firstEventAt(assignments, "VENDOR_DIRECT_PICKED_FROM_SHOP") != null
                    || hasVendorDirectInProgress(assignments)) {
                return "Out for Delivery";
            }
            if (firstEventAt(assignments, "VENDOR_DIRECT_ASSIGNED") != null
                    || (assignments != null && assignments.stream()
                            .anyMatch(a -> "VENDOR_DIRECT".equalsIgnoreCase(a.legType())))) {
                return "Agent Assigned";
            }
            return "Shop Preparing";
        }
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

    private static String stringVal(Map<String, Object> map, String key) {
        if (map == null || key == null) {
            return null;
        }
        Object value = map.get(key);
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }
}
