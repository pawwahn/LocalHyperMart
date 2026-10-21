package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.AddressClient;
import com.hyperlocalmart.order.client.MediaClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.client.VendorLaundryClient;
import com.hyperlocalmart.order.dto.laundry.LaundryActionRequest;
import com.hyperlocalmart.order.dto.laundry.LaundryOrderResponse;
import com.hyperlocalmart.order.dto.laundry.LaundryShopCard;
import com.hyperlocalmart.order.dto.laundry.PlaceLaundryOrderRequest;
import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import com.hyperlocalmart.order.entity.LaundryDaySeq;
import com.hyperlocalmart.order.entity.LaundryOrder;
import com.hyperlocalmart.order.entity.LaundryOrderEvent;
import com.hyperlocalmart.order.entity.LaundryOrderLine;
import com.hyperlocalmart.order.laundry.LaundryLogistics;
import com.hyperlocalmart.order.laundry.LaundryMove;
import com.hyperlocalmart.order.laundry.LaundryOrderStatus;
import com.hyperlocalmart.order.laundry.LaundryOrderWorkflow;
import com.hyperlocalmart.order.laundry.LaundryPaymentMethod;
import com.hyperlocalmart.order.laundry.LaundryPaymentStatus;
import com.hyperlocalmart.order.laundry.LaundryPhotoPolicy;
import com.hyperlocalmart.order.repository.LaundryDaySeqRepository;
import com.hyperlocalmart.order.repository.LaundryOrderEventRepository;
import com.hyperlocalmart.order.repository.LaundryOrderLineRepository;
import com.hyperlocalmart.order.repository.LaundryOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LaundryOrderService {

    public static final String SLA_MESSAGE = "This usually takes 1–3 days.";
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyMMdd");

    private final LaundryOrderRepository orderRepository;
    private final LaundryOrderLineRepository lineRepository;
    private final LaundryOrderEventRepository eventRepository;
    private final LaundryDaySeqRepository daySeqRepository;
    private final TownClient townClient;
    private final PaymentClient paymentClient;
    private final VendorLaundryClient vendorLaundryClient;
    private final AddressClient addressClient;
    private final MediaClient mediaClient;

    @Transactional(readOnly = true)
    public List<LaundryShopCard> shops(UUID townId) {
        requireTownLaundry(townId);
        return vendorLaundryClient.bookableShops(townId).stream()
                .map(shop -> LaundryShopCard.builder()
                        .vendorId(shop.vendorId())
                        .businessName(shop.businessName())
                        .phone(shop.phone())
                        .pickupCharge(moneyOrZero(shop.pickupCharge()))
                        .dropCharge(moneyOrZero(shop.dropCharge()))
                        .pickupAndDropCharge(moneyOrZero(shop.pickupAndDropCharge()))
                        .feeModel(shop.feeModel())
                        .perPieceAmount(moneyOrZero(shop.perPieceAmount()))
                        .perOrderFlatAmount(moneyOrZero(shop.perOrderFlatAmount()))
                        .rates(shop.rates() == null ? List.of() : shop.rates().stream()
                                .filter(rate -> rate.unitPrice() != null && rate.unitPrice().signum() > 0 && !rate.hidden())
                                .map(rate -> LaundryShopCard.RateCard.builder()
                                        .serviceType(rate.serviceType())
                                        .itemType(rate.itemType())
                                        .unitPrice(rate.unitPrice())
                                        .build())
                                .toList())
                        .build())
                .toList();
    }

    @Transactional
    public LaundryOrderResponse place(UUID buyerId, PlaceLaundryOrderRequest request) {
        if (!request.isSlaAcknowledged()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, SLA_MESSAGE + " Confirm that before placing the request.");
        }
        requireTownLaundry(request.getTownId());
        VendorLaundryClient.LaundryShopView shop = vendorLaundryClient.shop(request.getVendorId());
        if (!shop.enabled() || !"ACTIVE".equals(shop.vendorStatus())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This laundry shop is not taking requests");
        }
        if (shop.townId() == null || !shop.townId().equals(request.getTownId())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This shop is not in the selected town");
        }
        DayOfWeek today = LocalDate.now(IST).getDayOfWeek();
        if (shop.closedWeekdays() != null && shop.closedWeekdays().contains(today.name())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This shop is closed today");
        }
        LaundryLogistics logistics = parseLogistics(request.getLogistics());
        LaundryPaymentMethod paymentMethod = parsePayment(request.getPaymentMethod());
        TownClient.PaymentSettings paySettings = townClient.getPaymentSettings(request.getTownId());
        if (paymentMethod == LaundryPaymentMethod.CASH && !paySettings.codEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cash is not available in this town");
        }
        if (paymentMethod == LaundryPaymentMethod.UPI && !paySettings.upiEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "UPI is not available in this town");
        }
        boolean pickup = logistics != LaundryLogistics.DROP_ONLY;
        if (pickup && (request.getRequestedPickupStart() == null || request.getRequestedPickupEnd() == null
                || !request.getRequestedPickupEnd().isAfter(request.getRequestedPickupStart()))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose a pickup date and time slot");
        }
        if (pickup && request.getRequestedPickupStart().atZone(IST).toLocalDate().isBefore(LocalDate.now(IST))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose a pickup date that has not passed.");
        }
        if (pickup && !request.getRequestedPickupEnd().isAfter(Instant.now())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That pickup time has already passed. Choose a later slot.");
        }

        Map<String, Object> address = addressClient.getAddressSnapshot(request.getAddressId(), buyerId, request.getTownId());
        List<LaundryOrderLine> lines = buildLines(buyerId, shop, request.getLines());
        int pieces = lines.stream().mapToInt(LaundryOrderLine::getQuantity).sum();
        assertCapacity(shop, pieces);

        BigDecimal goods = goodsOf(lines);
        BigDecimal trip = tripCharge(shop, logistics);
        BigDecimal fee = moneyOrZero(townClient.resolveTownCheckoutFees(request.getTownId(), goods).platformFee());
        BigDecimal codFee = paymentMethod == LaundryPaymentMethod.CASH
                ? moneyOrZero(paySettings.codCharge())
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        Instant now = Instant.now();
        LocalDate day = LocalDate.now(IST);

        LaundryOrder order = LaundryOrder.builder()
                .orderNumber(nextNumber(day))
                .townId(request.getTownId())
                .vendorId(shop.vendorId())
                .shopName(shop.businessName() == null ? "Laundry" : shop.businessName())
                .buyerId(buyerId)
                .logistics(logistics)
                .status(paymentMethod == LaundryPaymentMethod.UPI
                        ? LaundryOrderStatus.AWAITING_PAYMENT
                        : pickup ? LaundryOrderStatus.PICKUP_SCHEDULED : LaundryOrderStatus.ACCEPTED)
                .paymentMethod(paymentMethod)
                .paymentStatus(LaundryPaymentStatus.DUE)
                .goodsAmount(goods.add(trip))
                .logisticsCharge(trip)
                .amountCollected(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .platformFeeModel("TOWN")
                .platformPerPiece(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .platformPerOrder(fee)
                .platformFeeAmount(fee)
                .codFee(codFee)
                .pieceCount(pieces)
                .specialInstructions(blank(request.getSpecialInstructions()))
                .addressId(request.getAddressId())
                .addressText(addressText(address))
                .contactName(text(address.get("recipientName")))
                .contactPhone(text(address.get("recipientPhone")))
                .requestedPickupStart(pickup ? request.getRequestedPickupStart() : null)
                .requestedPickupEnd(pickup ? request.getRequestedPickupEnd() : null)
                .pickupSlotStart(pickup ? request.getRequestedPickupStart() : null)
                .pickupSlotEnd(pickup ? request.getRequestedPickupEnd() : null)
                .pickupRescheduleCount(0)
                .rewashUsed(false)
                .complaintOpen(false)
                .placedAt(now)
                .lines(new ArrayList<>())
                .build();
        order.setCreatedBy(buyerId);
        order.setUpdatedBy(buyerId);
        for (LaundryOrderLine line : lines) {
            line.setOrder(order);
            line.setCreatedBy(buyerId);
            line.setUpdatedBy(buyerId);
            order.getLines().add(line);
        }
        try {
            orderRepository.saveAndFlush(order);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException(ErrorCode.CONFLICT, "That photo is already used on another item");
        }
        event(order, buyerId, "PLACE", null, order.getStatus().name(), SLA_MESSAGE);
        PaymentInfoResponse payment = null;
        if (paymentMethod == LaundryPaymentMethod.UPI) {
            payment = paymentClient.initiatePayment(
                    buyerId,
                    order.getId(),
                    order.getTownId(),
                    request.getPaymentGateway() == null || request.getPaymentGateway().isBlank()
                            ? "RAZORPAY" : request.getPaymentGateway(),
                    order.getId() + "-pay",
                    order.getContactPhone(),
                    buyerPayable(order),
                    order.getOrderNumber(),
                    "PAYMENT_PENDING",
                    "ONLINE");
        }
        LaundryOrderResponse response = toResponse(order, false);
        response.setPayment(payment);
        return response;
    }

    @Transactional(readOnly = true)
    public List<LaundryOrderResponse> buyerOrders(UUID buyerId, UUID townId) {
        return orderRepository.findByBuyerIdAndTownIdOrderByPlacedAtDesc(buyerId, townId).stream()
                .map(order -> toResponse(order, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public LaundryOrderResponse buyerOrder(UUID buyerId, UUID orderId) {
        LaundryOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This request is not yours");
        }
        return toResponse(order, false);
    }

    @Transactional
    public void markOnlinePaid(UUID orderId, UUID buyerId) {
        LaundryOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
        if (order.getStatus() != LaundryOrderStatus.AWAITING_PAYMENT) {
            return;
        }
        boolean pickup = order.getLogistics() != LaundryLogistics.DROP_ONLY;
        LaundryOrderStatus next = pickup ? LaundryOrderStatus.PICKUP_SCHEDULED : LaundryOrderStatus.ACCEPTED;
        order.setStatus(next);
        order.setPaymentStatus(LaundryPaymentStatus.COLLECTED);
        order.setAmountCollected(buyerPayable(order));
        order.setUpdatedBy(buyerId);
        orderRepository.save(order);
        event(order, buyerId, "PAY", LaundryOrderStatus.AWAITING_PAYMENT.name(), next.name(), "Online payment received");
    }

    @Transactional
    public void markOnlineFailed(UUID orderId, UUID buyerId) {
        LaundryOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
    }

    @Transactional
    public PaymentInfoResponse retryOnlinePayment(UUID buyerId, UUID orderId, String idempotencyKey, String gateway) {
        LaundryOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
        if (order.getPaymentMethod() != LaundryPaymentMethod.UPI || order.getStatus() != LaundryOrderStatus.AWAITING_PAYMENT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This order is not waiting for online payment");
        }
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? order.getId() + "-pay" : idempotencyKey;
        return paymentClient.initiatePayment(
                buyerId,
                order.getId(),
                order.getTownId(),
                gateway == null || gateway.isBlank() ? "RAZORPAY" : gateway,
                key,
                order.getContactPhone(),
                buyerPayable(order),
                order.getOrderNumber(),
                "PAYMENT_PENDING",
                "ONLINE");
    }

    @Transactional
    public LaundryOrderResponse buyerCancel(UUID buyerId, UUID orderId) {
        LaundryOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This request is not yours");
        }
        return move(order, buyerId, LaundryMove.CANCEL, null, null, "Cancelled by customer", false);
    }

    @Transactional
    public LaundryOrderResponse buyerComment(UUID buyerId, UUID orderId, String comment) {
        LaundryOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
        if (order.getStatus() == LaundryOrderStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "A cancelled order cannot be commented");
        }
        order.setBuyerComment(blank(comment));
        order.setUpdatedBy(buyerId);
        orderRepository.save(order);
        event(order, buyerId, "BUYER_COMMENT", order.getStatus().name(), order.getStatus().name(), blank(comment));
        return toResponse(order, false);
    }

    @Transactional
    public LaundryOrderResponse buyerComplaint(UUID buyerId, UUID orderId, boolean open, String note) {
        LaundryOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This request is not yours");
        }
        return setComplaint(order, buyerId, open, note);
    }

    @Transactional(readOnly = true)
    public List<LaundryOrderResponse> vendorOrders(UUID userId) {
        UUID vendorId = vendorLaundryClient.vendorIdForUser(userId);
        return orderRepository.findByVendorIdOrderByPlacedAtDesc(vendorId).stream()
                .filter(order -> order.getStatus() != LaundryOrderStatus.AWAITING_PAYMENT)
                .map(order -> toResponse(order, true))
                .toList();
    }

    @Transactional
    public LaundryOrderResponse vendorAct(UUID userId, UUID orderId, LaundryActionRequest request) {
        UUID vendorId = vendorLaundryClient.vendorIdForUser(userId);
        LaundryOrder order = requireOrder(orderId);
        if (!order.getVendorId().equals(vendorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This request is for another shop");
        }
        if (order.getStatus() == LaundryOrderStatus.AWAITING_PAYMENT) {
            throw new BusinessException(ErrorCode.CONFLICT, "This order is waiting for online payment");
        }
        String action = request.getAction() == null ? "" : request.getAction().trim().toUpperCase();
        return switch (action) {
            case "ADJUST" -> adjust(order, userId, request);
            case "SETTLE_PAYMENT" -> settle(order, userId);
            case "SET_ESTIMATE" -> setEstimate(order, userId, request.getEstimatedReadyAt());
            case "SET_COMMENT" -> setVendorComment(order, userId, request.getNote());
            case "OPEN_COMPLAINT" -> setComplaint(order, userId, true, request.getNote());
            case "CLOSE_COMPLAINT" -> setComplaint(order, userId, false, request.getNote());
            default -> {
                LaundryMove move;
                try {
                    move = LaundryMove.valueOf(action);
                } catch (IllegalArgumentException ex) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown laundry action");
                }
                boolean reject = move == LaundryMove.CANCEL;
                yield move(order, userId, move, request.getPickupSlotStart(), request.getPickupSlotEnd(),
                        reject ? "Rejected by the shop" : request.getNote(), reject);
            }
        };
    }

    @Transactional(readOnly = true)
    public List<LaundryOrderResponse> adminOrders(UUID townId) {
        return orderRepository.findByTownIdOrderByPlacedAtDesc(townId).stream()
                .map(order -> toResponse(order, true))
                .toList();
    }

    @Transactional
    public void purgePhoto(UUID lineId) {
        LaundryOrderLine line = lineRepository.findById(lineId).orElse(null);
        if (line == null || line.getPhotoMediaId() == null || line.getPhotoDeletedAt() != null) {
            return;
        }
        LaundryOrder order = line.getOrder();
        if (!LaundryPhotoPolicy.due(order.getDeliveredAt(), order.isComplaintOpen(), line.getPhotoDeletedAt(), Instant.now())) {
            return;
        }
        UUID mediaId = line.getPhotoMediaId();
        mediaClient.deleteOne(mediaId);
        line.setPhotoDeletedAt(Instant.now());
        lineRepository.save(line);
    }

    private LaundryOrderResponse move(
            LaundryOrder order,
            UUID actorId,
            LaundryMove move,
            Instant slotStart,
            Instant slotEnd,
            String note,
            boolean creditWallet) {
        LaundryOrderStatus from = order.getStatus();
        boolean reschedule = LaundryOrderWorkflow.countsAsReschedule(from, move);
        LaundryOrderStatus to = LaundryOrderWorkflow.next(
                order.getLogistics(), from, move, order.getPickupRescheduleCount(), order.isRewashUsed());
        if (move == LaundryMove.SCHEDULE_PICKUP) {
            if (slotStart == null || slotEnd == null || !slotEnd.isAfter(slotStart)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Pickup slot start and end are required");
            }
            order.setPickupSlotStart(slotStart);
            order.setPickupSlotEnd(slotEnd);
            if (reschedule) {
                order.setPickupRescheduleCount(order.getPickupRescheduleCount() + 1);
            }
        }
        if (move == LaundryMove.REWASH) {
            order.setRewashUsed(true);
            order.setDeliveredAt(null);
        }
        if (to == LaundryOrderStatus.DELIVERED) {
            order.setDeliveredAt(Instant.now());
        }
        if (to == LaundryOrderStatus.CANCELLED && creditWallet) {
            creditRejectToWallet(order);
            order.setAmountCollected(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            order.setPaymentStatus(LaundryPaymentStatus.REFUNDED);
        } else if (to == LaundryOrderStatus.CANCELLED) {
            refreshPayment(order);
        } else {
            refreshPayment(order);
        }
        order.setStatus(to);
        order.setUpdatedBy(actorId);
        orderRepository.save(order);
        event(order, actorId, move.name(), from.name(), to.name(), blank(note));
        return toResponse(order, true);
    }

    private LaundryOrderResponse setEstimate(LaundryOrder order, UUID actorId, Instant estimatedReadyAt) {
        if (order.getStatus() == LaundryOrderStatus.CANCELLED || order.getStatus() == LaundryOrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "The estimate can be set before delivery");
        }
        order.setEstimatedReadyAt(estimatedReadyAt);
        order.setUpdatedBy(actorId);
        orderRepository.save(order);
        event(order, actorId, "SET_ESTIMATE", order.getStatus().name(), order.getStatus().name(),
                estimatedReadyAt == null ? "Estimate cleared" : estimatedReadyAt.toString());
        return toResponse(order, true);
    }

    private LaundryOrderResponse setVendorComment(LaundryOrder order, UUID actorId, String comment) {
        if (order.getStatus() == LaundryOrderStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "A cancelled order cannot be commented");
        }
        order.setVendorComment(blank(comment));
        order.setUpdatedBy(actorId);
        orderRepository.save(order);
        event(order, actorId, "VENDOR_COMMENT", order.getStatus().name(), order.getStatus().name(), blank(comment));
        return toResponse(order, true);
    }

    private void creditRejectToWallet(LaundryOrder order) {
        BigDecimal already = moneyOrZero(order.getWalletCredited());
        if (already.signum() > 0) {
            return;
        }
        BigDecimal amount = buyerPayable(order);
        if (amount.signum() <= 0) {
            return;
        }
        try {
            paymentClient.creditWallet(
                    order.getBuyerId(),
                    amount,
                    "LAUNDRY_CANCEL",
                    order.getId(),
                    order.getId(),
                    order.getLines().isEmpty() ? order.getId() : order.getLines().getFirst().getId(),
                    "Laundry order " + order.getOrderNumber() + " rejected");
        } catch (RuntimeException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not credit the customer wallet. Try again.");
        }
        order.setWalletCredited(amount);
    }

    private LaundryOrderResponse adjust(LaundryOrder order, UUID actorId, LaundryActionRequest request) {
        if (order.getStatus() == LaundryOrderStatus.CANCELLED || order.getStatus() == LaundryOrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "The bill can be corrected before delivery");
        }
        if (request.getLines() == null || request.getLines().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Add the corrected lines");
        }
        for (LaundryActionRequest.LinePatch patch : request.getLines()) {
            LaundryOrderLine line = order.getLines().stream()
                    .filter(item -> item.getId().equals(patch.getLineId()))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order line not found"));
            if (patch.getConfirmedQuantity() != null) {
                if (patch.getConfirmedQuantity() < 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Quantity cannot be negative");
                }
                line.setConfirmedQuantity(patch.getConfirmedQuantity());
            }
            if (patch.getUnitPrice() != null) {
                if (!"OTHER".equals(line.getItemType())) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Only Other items can have a corrected price");
                }
                if (patch.getUnitPrice().compareTo(BigDecimal.ZERO) < 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Price must be ₹0 or more");
                }
                line.setUnitPrice(patch.getUnitPrice().setScale(2, RoundingMode.HALF_UP));
            }
            if (patch.getConditionNote() != null) {
                line.setConditionNote(blank(patch.getConditionNote()));
            }
            line.setUpdatedBy(actorId);
        }
        int pieces = order.getLines().stream().mapToInt(LaundryOrderLine::getConfirmedQuantity).sum();
        BigDecimal fee = platformFee(order.getPlatformFeeModel(), order.getPlatformPerPiece(), order.getPlatformPerOrder(), pieces);
        order.setPieceCount(pieces);
        order.setPlatformFeeAmount(fee);
        order.setGoodsAmount(goodsOf(order.getLines()).add(moneyOrZero(order.getLogisticsCharge())));
        order.setUpdatedBy(actorId);
        refreshPayment(order);
        orderRepository.save(order);
        event(order, actorId, "ADJUST", order.getStatus().name(), order.getStatus().name(), blank(request.getNote()));
        return toResponse(order, true);
    }

    private LaundryOrderResponse settle(LaundryOrder order, UUID actorId) {
        if (order.getStatus() == LaundryOrderStatus.CANCELLED) {
            order.setAmountCollected(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            order.setPaymentStatus(LaundryPaymentStatus.REFUNDED);
        } else {
            order.setAmountCollected(buyerPayable(order));
            order.setPaymentStatus(LaundryPaymentStatus.COLLECTED);
        }
        order.setUpdatedBy(actorId);
        orderRepository.save(order);
        event(order, actorId, "SETTLE_PAYMENT", order.getStatus().name(), order.getStatus().name(),
                "Payment matched to ₹" + order.getAmountCollected().toPlainString());
        return toResponse(order, true);
    }

    private LaundryOrderResponse setComplaint(LaundryOrder order, UUID actorId, boolean open, String note) {
        if (order.getStatus() == LaundryOrderStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "A cancelled request has no complaint");
        }
        order.setComplaintOpen(open);
        order.setUpdatedBy(actorId);
        orderRepository.save(order);
        event(order, actorId, open ? "OPEN_COMPLAINT" : "CLOSE_COMPLAINT",
                order.getStatus().name(), order.getStatus().name(), blank(note));
        return toResponse(order, true);
    }

    private void refreshPayment(LaundryOrder order) {
        BigDecimal payable = buyerPayable(order);
        BigDecimal collected = order.getAmountCollected() == null
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : order.getAmountCollected();
        if (order.getStatus() == LaundryOrderStatus.CANCELLED) {
            order.setPaymentStatus(collected.signum() > 0 ? LaundryPaymentStatus.REFUND_DUE : LaundryPaymentStatus.REFUNDED);
            return;
        }
        int cmp = collected.compareTo(payable);
        if (collected.signum() == 0) {
            order.setPaymentStatus(LaundryPaymentStatus.DUE);
        } else if (cmp == 0) {
            order.setPaymentStatus(LaundryPaymentStatus.COLLECTED);
        } else if (cmp < 0) {
            order.setPaymentStatus(LaundryPaymentStatus.EXTRA_DUE);
        } else {
            order.setPaymentStatus(LaundryPaymentStatus.REFUND_DUE);
        }
    }

    private List<LaundryOrderLine> buildLines(
            UUID buyerId,
            VendorLaundryClient.LaundryShopView shop,
            List<PlaceLaundryOrderRequest.LineInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Add at least one item");
        }
        Set<UUID> photos = new HashSet<>();
        List<LaundryOrderLine> lines = new ArrayList<>();
        for (PlaceLaundryOrderRequest.LineInput input : inputs) {
            String service = token(input.getServiceType());
            String item = token(input.getItemType());
            if (input.getQuantity() == null || input.getQuantity() < 1) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Quantity must be at least 1");
            }
            BigDecimal price = priceOf(shop, service, item);
            if (price.signum() <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This shop has no rate for " + itemLabel(item));
            }
            String other = blank(input.getOtherLabel());
            if ("OTHER".equals(item) && other == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Name the other item");
            }
            UUID photoId = input.getPhotoMediaId();
            if (photoId != null) {
                if (!photos.add(photoId) || lineRepository.existsByPhotoMediaId(photoId)) {
                    throw new BusinessException(ErrorCode.CONFLICT, "Each photo can be used on one item");
                }
                MediaClient.MediaMeta meta = mediaClient.meta(photoId);
                if (meta.ownerUserId() == null || !meta.ownerUserId().equals(buyerId)) {
                    throw new BusinessException(ErrorCode.FORBIDDEN, "Photo does not belong to this customer");
                }
                if (!"LAUNDRY_ITEM".equals(meta.context())) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Photo must be a laundry item photo");
                }
            }
            lines.add(LaundryOrderLine.builder()
                    .serviceType(service)
                    .itemType(item)
                    .otherLabel(other)
                    .quantity(input.getQuantity())
                    .confirmedQuantity(input.getQuantity())
                    .unitPrice(price)
                    .photoMediaId(photoId)
                    .build());
        }
        return lines;
    }

    private void assertCapacity(VendorLaundryClient.LaundryShopView shop, int pieces) {
        if (shop.dailyPieceCapacity() == null) {
            return;
        }
        LocalDate today = LocalDate.now(IST);
        Instant from = today.atStartOfDay(IST).toInstant();
        Instant to = today.plusDays(1).atStartOfDay(IST).toInstant();
        long booked = orderRepository.piecesBooked(shop.vendorId(), LaundryOrderStatus.CANCELLED, from, to);
        if (booked + pieces > shop.dailyPieceCapacity()) {
            throw new BusinessException(ErrorCode.CONFLICT, "This shop has no piece capacity left today");
        }
    }

    private String nextNumber(LocalDate day) {
        LaundryDaySeq seq = daySeqRepository.lockDay(day).orElseGet(() -> {
            LaundryDaySeq created = new LaundryDaySeq();
            created.setDay(day);
            created.setLastNo(0);
            return daySeqRepository.save(created);
        });
        seq.setLastNo(seq.getLastNo() + 1);
        daySeqRepository.save(seq);
        return "L" + DAY.format(day) + "-" + String.format("%04d", seq.getLastNo());
    }

    private void event(LaundryOrder order, UUID actorId, String action, String from, String to, String note) {
        LaundryOrderEvent row = LaundryOrderEvent.builder()
                .orderId(order.getId())
                .action(action)
                .fromStatus(from)
                .toStatus(to)
                .note(note)
                .build();
        row.setCreatedBy(actorId);
        row.setUpdatedBy(actorId);
        eventRepository.save(row);
    }

    private LaundryOrderResponse toResponse(LaundryOrder order, boolean shopView) {
        List<String> actions = new ArrayList<>(LaundryOrderWorkflow.allowedMoves(
                order.getLogistics(), order.getStatus(), order.getPickupRescheduleCount(), order.isRewashUsed()));
        if (shopView && order.getStatus() != LaundryOrderStatus.CANCELLED
                && order.getStatus() != LaundryOrderStatus.AWAITING_PAYMENT) {
            if (order.getPaymentMethod() != LaundryPaymentMethod.UPI) {
                actions.add("SETTLE_PAYMENT");
            }
            actions.add("SET_ESTIMATE");
            actions.add("SET_COMMENT");
        }
        if (shopView && order.getStatus() == LaundryOrderStatus.CANCELLED
                && order.getPaymentStatus() == LaundryPaymentStatus.REFUND_DUE) {
            actions.add("SETTLE_PAYMENT");
        }
        return LaundryOrderResponse.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .townId(order.getTownId())
                .vendorId(order.getVendorId())
                .shopName(order.getShopName())
                .buyerId(order.getBuyerId())
                .logistics(order.getLogistics().name())
                .status(order.getStatus().name())
                .statusLabel(order.getStatus().label())
                .paymentMethod(order.getPaymentMethod().name())
                .paymentStatus(order.getPaymentStatus().name())
                .goodsAmount(order.getGoodsAmount())
                .logisticsCharge(moneyOrZero(order.getLogisticsCharge()))
                .amountCollected(order.getAmountCollected())
                .platformFeeAmount(order.getPlatformFeeAmount())
                .codFee(moneyOrZero(order.getCodFee()))
                .platformFeeModel(order.getPlatformFeeModel())
                .pieceCount(order.getPieceCount())
                .specialInstructions(order.getSpecialInstructions())
                .addressText(order.getAddressText())
                .contactName(order.getContactName())
                .contactPhone(order.getContactPhone())
                .requestedPickupStart(order.getRequestedPickupStart())
                .requestedPickupEnd(order.getRequestedPickupEnd())
                .pickupSlotStart(order.getPickupSlotStart())
                .pickupSlotEnd(order.getPickupSlotEnd())
                .estimatedReadyAt(order.getEstimatedReadyAt())
                .buyerComment(order.getBuyerComment())
                .vendorComment(order.getVendorComment())
                .walletCredited(moneyOrZero(order.getWalletCredited()))
                .pickupRescheduleCount(order.getPickupRescheduleCount())
                .rewashUsed(order.isRewashUsed())
                .complaintOpen(order.isComplaintOpen())
                .placedAt(order.getPlacedAt())
                .deliveredAt(order.getDeliveredAt())
                .slaMessage(SLA_MESSAGE)
                .allowedActions(actions)
                .lines(order.getLines().stream().map(this::lineResponse).toList())
                .build();
    }

    private LaundryOrderResponse.LineResponse lineResponse(LaundryOrderLine line) {
        boolean deleted = line.getPhotoDeletedAt() != null;
        BigDecimal qty = BigDecimal.valueOf(line.getConfirmedQuantity());
        return LaundryOrderResponse.LineResponse.builder()
                .id(line.getId())
                .serviceType(line.getServiceType())
                .itemType(line.getItemType())
                .otherLabel(line.getOtherLabel())
                .quantity(line.getQuantity())
                .confirmedQuantity(line.getConfirmedQuantity())
                .unitPrice(line.getUnitPrice())
                .lineAmount(line.getUnitPrice().multiply(qty).setScale(2, RoundingMode.HALF_UP))
                .conditionNote(line.getConditionNote())
                .photoMediaId(deleted ? null : line.getPhotoMediaId())
                .photoUrl(deleted || line.getPhotoMediaId() == null ? null : "/api/v1/media/" + line.getPhotoMediaId() + "/content")
                .photoDeleted(deleted)
                .build();
    }

    private void requireTownLaundry(UUID townId) {
        if (!townClient.isLaundryEnabled(townId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Laundry is not available in this town");
        }
    }

    private LaundryOrder requireOrder(UUID orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Laundry request not found"));
    }

    private static BigDecimal tripCharge(VendorLaundryClient.LaundryShopView shop, LaundryLogistics logistics) {
        BigDecimal raw = switch (logistics) {
            case PICKUP_ONLY -> shop.pickupCharge();
            case DROP_ONLY -> shop.dropCharge();
            case PICKUP_AND_DROP -> shop.pickupAndDropCharge();
        };
        return moneyOrZero(raw);
    }

    private static BigDecimal goodsOf(List<LaundryOrderLine> lines) {
        BigDecimal total = BigDecimal.ZERO;
        for (LaundryOrderLine line : lines) {
            total = total.add(line.getUnitPrice().multiply(BigDecimal.valueOf(line.getConfirmedQuantity())));
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal buyerPayable(LaundryOrder order) {
        return moneyOrZero(order.getGoodsAmount())
                .add(moneyOrZero(order.getPlatformFeeAmount()))
                .add(moneyOrZero(order.getCodFee()));
    }

    private static BigDecimal platformFee(String model, BigDecimal perPiece, BigDecimal perOrder, int pieces) {
        if (model == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal fee = switch (model) {
            case "PER_PIECE", "PER_PIECE_WITH_SUBSCRIPTION" -> perPiece.multiply(BigDecimal.valueOf(Math.max(pieces, 0)));
            case "PER_ORDER_FLAT", "PER_ORDER_WITH_SUBSCRIPTION", "TOWN" -> perOrder;
            default -> BigDecimal.ZERO;
        };
        return fee.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal priceOf(VendorLaundryClient.LaundryShopView shop, String service, String item) {
        if (shop.rates() == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return shop.rates().stream()
                .filter(rate -> service.equals(rate.serviceType()) && item.equals(rate.itemType()) && !rate.hidden())
                .map(VendorLaundryClient.LaundryShopView.RateView::unitPrice)
                .findFirst()
                .map(price -> price.setScale(2, RoundingMode.HALF_UP))
                .orElse(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
    }

    private static String addressText(Map<String, Object> address) {
        List<String> parts = new ArrayList<>();
        for (String key : List.of("line1", "line2", "landmark", "pincode")) {
            String value = text(address.get(key));
            if (value != null) {
                parts.add(value);
            }
        }
        String joined = String.join(", ", parts);
        if (joined.length() > 500) {
            return joined.substring(0, 500);
        }
        if (joined.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Address is missing a street line");
        }
        return joined;
    }

    private static LaundryLogistics parseLogistics(String raw) {
        try {
            return LaundryLogistics.valueOf(token(raw));
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose pickup and drop, pickup only, or drop only");
        }
    }

    private static LaundryPaymentMethod parsePayment(String raw) {
        try {
            return LaundryPaymentMethod.valueOf(token(raw));
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose cash or UPI");
        }
    }

    private static String token(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Missing value");
        }
        return raw.trim().toUpperCase();
    }

    private static String blank(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    private static String text(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = String.valueOf(raw).trim();
        return value.isEmpty() || "null".equals(value) ? null : value;
    }

    private static BigDecimal moneyOrZero(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String itemLabel(String item) {
        return switch (item) {
            case "SAREE" -> "saree";
            case "SHIRT" -> "shirt";
            case "PANTS" -> "pants";
            case "CURTAINS" -> "curtains";
            case "BEDSHEET" -> "bed sheet";
            case "TOWEL" -> "towel";
            case "PILLOW_COVER" -> "pillow cover";
            case "BLANKET" -> "blanket";
            case "SHERWANI" -> "sherwani";
            case "LEHENGA" -> "lehenga";
            case "SUIT" -> "suit";
            case "SALWAR_SUIT" -> "salwar suit";
            case "KURTA" -> "kurta";
            case "T_SHIRT" -> "t-shirt";
            case "HOODIE" -> "hoodie";
            case "JACKET" -> "jacket";
            case "SWEATER" -> "sweater";
            case "DRESS" -> "dress";
            case "KIDS_WEAR" -> "kids wear";
            case "BLOUSE" -> "blouse";
            case "DHOTI" -> "dhoti";
            case "NIGHTWEAR" -> "nightwear";
            case "UNDERGARMENT" -> "undergarment";
            case "TABLE_CLOTH" -> "table cloth";
            case "CUSHION_COVER" -> "cushion cover";
            case "SOFT_TOY" -> "soft toy";
            case "OTHER" -> "other";
            default -> "that item";
        };
    }
}
