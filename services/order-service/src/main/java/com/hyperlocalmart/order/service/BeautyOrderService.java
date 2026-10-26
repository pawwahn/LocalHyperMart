package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.beauty.BeautySlotBlocks;
import com.hyperlocalmart.common.beauty.BeautySlotSchedule;
import com.hyperlocalmart.common.beauty.BeautySlots;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.beauty.BeautyMove;
import com.hyperlocalmart.order.beauty.BeautyOrderStatus;
import com.hyperlocalmart.order.beauty.BeautyOrderWorkflow;
import com.hyperlocalmart.order.beauty.BeautyPaymentMethod;
import com.hyperlocalmart.order.beauty.BeautyPaymentStatus;
import com.hyperlocalmart.order.beauty.BeautyVenue;
import com.hyperlocalmart.order.client.AddressClient;
import com.hyperlocalmart.order.client.MediaClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.client.VendorBeautyClient;
import com.hyperlocalmart.order.dto.beauty.BeautyActionRequest;
import com.hyperlocalmart.order.dto.beauty.BeautyArtistCard;
import com.hyperlocalmart.order.dto.beauty.BeautyAvailabilityResponse;
import com.hyperlocalmart.order.dto.beauty.BeautyOrderResponse;
import com.hyperlocalmart.order.dto.beauty.PlaceBeautyOrderRequest;
import com.hyperlocalmart.order.dto.beauty.RateBeautyOrderRequest;
import com.hyperlocalmart.order.entity.BeautyOrderRating;
import com.hyperlocalmart.order.repository.BeautyOrderRatingRepository;
import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import com.hyperlocalmart.order.entity.BeautyDaySeq;
import com.hyperlocalmart.order.entity.BeautyOrder;
import com.hyperlocalmart.order.entity.BeautyOrderEvent;
import com.hyperlocalmart.order.repository.BeautyDaySeqRepository;
import com.hyperlocalmart.order.repository.BeautyOrderEventRepository;
import com.hyperlocalmart.order.repository.BeautyOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BeautyOrderService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyMMdd");

    private final BeautyOrderRepository orderRepository;
    private final BeautyOrderRatingRepository ratingRepository;
    private final BeautyOrderEventRepository eventRepository;
    private final BeautyDaySeqRepository daySeqRepository;
    private final TownClient townClient;
    private final PaymentClient paymentClient;
    private final VendorBeautyClient vendorBeautyClient;
    private final AddressClient addressClient;
    private final MediaClient mediaClient;
    private final ScratchCardService scratchCardService;

    @Transactional(readOnly = true)
    public List<BeautyArtistCard> artists(UUID townId) {
        requireTownBeauty(townId);
        return vendorBeautyClient.bookableArtists(townId).stream()
                .map(shop -> BeautyArtistCard.builder()
                        .vendorId(shop.vendorId())
                        .businessName(shop.businessName())
                        .phone(shop.phone())
                        .tagline(shop.tagline())
                        .yearsExperience(shop.yearsExperience())
                        .ratingScore(moneyOrZero(shop.ratingScore()))
                        .ratingCount(shop.ratingCount() == null ? 0 : shop.ratingCount())
                        .homeVisitCharge(moneyOrZero(shop.homeVisitCharge()))
                        .studioAddress(shop.studioAddress())
                        .closedWeekdays(shop.closedWeekdays())
                        .blockedSlotDate(shop.blockedSlotDate())
                        .blockedSlotIds(shop.blockedSlotIds())
                        .blockedSlotsByDate(shop.blockedSlotsByDate())
                        .staffCount(shop.staffCapacity())
                        .slotDayOpen(shop.slotSchedule().dayOpenText())
                        .slotDayClose(shop.slotSchedule().dayCloseText())
                        .slotIntervalMinutes(shop.slotSchedule().intervalMinutes())
                        .bookingMinPrepayAmount(moneyOrZero(shop.bookingMinPrepayAmount()))
                        .rates(shop.rates() == null ? List.of() : shop.rates().stream()
                                .filter(rate -> rate.unitPrice() != null && rate.unitPrice().signum() > 0 && !rate.hidden())
                                .map(rate -> BeautyArtistCard.ServiceRate.builder()
                                        .serviceType(rate.serviceType())
                                        .label(rate.label())
                                        .hint(rate.hint())
                                        .emoji(rate.emoji())
                                        .unitPrice(rate.unitPrice())
                                        .durationMinutes(rate.durationMinutes())
                                        .paused(Boolean.TRUE.equals(rate.paused()))
                                        .build())
                                .toList())
                        .build())
                .filter(card -> card.getRates() != null && !card.getRates().isEmpty())
                .toList();
    }

    @Transactional(readOnly = true)
    public BeautyAvailabilityResponse availability(UUID vendorId, LocalDate date) {
        VendorBeautyClient.BeautyArtistView artist = vendorBeautyClient.artist(vendorId);
        if (!artist.enabled() || !"ACTIVE".equals(artist.vendorStatus())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This artist is not taking bookings");
        }
        LocalDate day = date == null ? LocalDate.now(IST) : date;
        BeautySlotSchedule schedule = artist.slotSchedule();
        int defaultStaff = artist.staffCapacity();
        int capacity = artist.staffCapacityFor(day);
        Instant rangeStart = day.atTime(LocalTime.MIDNIGHT).atZone(IST).toInstant();
        Instant rangeEnd = day.plusDays(1).atTime(LocalTime.MIDNIGHT).atZone(IST).toInstant();
        List<BeautyOrder> orders = orderRepository
                .findByVendorIdAndSlotStartGreaterThanEqualAndSlotStartLessThanAndStatusNotOrderBySlotStartAsc(
                        vendorId, rangeStart, rangeEnd, BeautyOrderStatus.CANCELLED);
        Map<String, Integer> bookedBySlot = new HashMap<>();
        for (BeautyOrder order : orders) {
            String slotId = schedule.idFromInstant(order.getSlotStart());
            if (schedule.isValidId(slotId)) {
                bookedBySlot.merge(slotId, 1, Integer::sum);
            }
        }
        Set<String> manualBlocks = manualBlocksForDate(artist, day, schedule);
        List<BeautyAvailabilityResponse.SlotAvailability> rows = new ArrayList<>();
        for (String slotId : schedule.allIds()) {
            Instant slotStart = schedule.slotInstant(day, slotId);
            if (slotStart == null) {
                continue;
            }
            rows.add(BeautyAvailabilityResponse.SlotAvailability.builder()
                    .slotId(slotId)
                    .booked(bookedBySlot.getOrDefault(slotId, 0))
                    .capacity(capacity)
                    .manuallyBlocked(manualBlocks.contains(slotId))
                    .build());
        }
        return BeautyAvailabilityResponse.builder()
                .vendorId(vendorId)
                .date(day.toString())
                .staffCount(capacity)
                .defaultStaffCount(defaultStaff)
                .slotDayOpen(schedule.dayOpenText())
                .slotDayClose(schedule.dayCloseText())
                .slotIntervalMinutes(schedule.intervalMinutes())
                .slots(rows)
                .build();
    }

    @Transactional
    public BeautyOrderResponse place(UUID buyerId, PlaceBeautyOrderRequest request) {
        requireTownBeauty(request.getTownId());
        VendorBeautyClient.BeautyArtistView artist = vendorBeautyClient.artist(request.getVendorId());
        if (!artist.enabled() || !"ACTIVE".equals(artist.vendorStatus())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This artist is not taking bookings");
        }
        if (artist.townId() == null || !artist.townId().equals(request.getTownId())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This artist is not in the selected town");
        }
        DayOfWeek today = LocalDate.now(IST).getDayOfWeek();
        if (artist.closedWeekdays() != null && artist.closedWeekdays().contains(today.name())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This artist is off today");
        }
        BeautyVenue venue = parseVenue(request.getVenue());
        BeautyPaymentMethod paymentMethod = parsePayment(request.getPaymentMethod());
        TownClient.PaymentSettings paySettings = townClient.getPaymentSettings(request.getTownId());
        if (paymentMethod == BeautyPaymentMethod.CASH) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Glam bookings require online payment — cash is not available");
        }
        if (paymentMethod != BeautyPaymentMethod.UPI || !paySettings.upiEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "UPI is required for glam bookings in this town");
        }
        if (request.getSlotStart() == null || request.getSlotEnd() == null
                || !request.getSlotEnd().isAfter(request.getSlotStart())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose an appointment slot");
        }
        if (request.getSlotStart().atZone(IST).toLocalDate().isBefore(LocalDate.now(IST))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose a date that has not passed");
        }
        if (request.getSlotStart().isBefore(Instant.now().plus(Duration.ofHours(BeautySlots.LEAD_HOURS)))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Bookings need 1 hour’s notice. Pick a later slot.");
        }
        BeautySlotSchedule schedule = artist.slotSchedule();
        if (!schedule.aligns(request.getSlotStart())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose a valid appointment time for this artist");
        }
        if (slotBlocked(artist, request.getSlotStart(), schedule)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That slot is unavailable. Try another time.");
        }
        LocalDate slotDay = request.getSlotStart().atZone(IST).toLocalDate();
        int capacity = artist.staffCapacityFor(slotDay);
        long booked = orderRepository.countByVendorIdAndSlotStartAndStatusNot(
                artist.vendorId(), request.getSlotStart(), BeautyOrderStatus.CANCELLED);
        if (booked >= capacity) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That slot is full. Try another time.");
        }

        List<String> serviceCodes = resolveServiceTypes(request);
        if (serviceCodes.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose at least one service");
        }
        List<VendorBeautyClient.BeautyArtistView.RateView> chosenRates = new ArrayList<>();
        for (String code : serviceCodes) {
            VendorBeautyClient.BeautyArtistView.RateView rate = artist.rates().stream()
                    .filter(row -> code.equalsIgnoreCase(row.serviceType()) && !row.hidden())
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Service not offered: " + code));
            chosenRates.add(rate);
        }
        BigDecimal servicePrice = chosenRates.stream()
                .map(row -> moneyOrZero(row.unitPrice()))
                .reduce(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP), BigDecimal::add);
        if (servicePrice.signum() <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Service price is not set");
        }
        int totalMinutes = chosenRates.stream()
                .mapToInt(row -> row.durationMinutes() == null ? 60 : row.durationMinutes())
                .sum();
        String serviceTypesCsv = String.join(",", serviceCodes);
        String primaryService = serviceCodes.getFirst();
        BigDecimal travel = venue == BeautyVenue.AT_HOME ? moneyOrZero(artist.homeVisitCharge()) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal platformFee = moneyOrZero(townClient.resolveTownCheckoutFees(request.getTownId(), servicePrice).platformFee());
        BigDecimal codFee = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        TownClient.BeautyBookingSettings glamPay = townClient.getBeautyBookingSettings(request.getTownId());
        BigDecimal townMinPrepay = moneyOrZero(glamPay.beautyMinPrepayAmount());
        BigDecimal minPrepay = townMinPrepay.signum() > 0 ? townMinPrepay : moneyOrZero(artist.bookingMinPrepayAmount());
        boolean partialRequested = "PARTIAL".equalsIgnoreCase(
                request.getPrepayMode() == null ? "" : request.getPrepayMode().trim());
        BigDecimal parlourFee = partialRequested
                ? moneyOrZero(glamPay.beautyParlourPaymentFee())
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal amountDueTotal = servicePrice.add(travel).add(platformFee).add(codFee).add(parlourFee)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal payNow = resolvePrepayAmount(amountDueTotal, minPrepay, partialRequested);

        String addressText = null;
        UUID addressId = null;
        String contactName = null;
        String contactPhone = null;
        if (venue == BeautyVenue.AT_HOME) {
            if (request.getAddressId() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose an address for the home visit");
            }
            Map<String, Object> address = addressClient.getAddressSnapshot(request.getAddressId(), buyerId, request.getTownId());
            addressId = request.getAddressId();
            addressText = addressText(address);
            contactName = text(address.get("recipientName"));
            contactPhone = text(address.get("recipientPhone"));
        } else if (artist.studioAddress() == null || artist.studioAddress().isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Studio address is not set for this artist");
        }

        UUID referencePhotoMediaId = request.getReferencePhotoMediaId();
        if (referencePhotoMediaId != null) {
            assertReferencePhoto(referencePhotoMediaId, buyerId);
        }

        Instant now = Instant.now();
        BeautyOrderStatus status = BeautyOrderStatus.AWAITING_PAYMENT;

        BeautyOrder order = BeautyOrder.builder()
                .orderNumber(nextNumber(LocalDate.now(IST)))
                .townId(request.getTownId())
                .vendorId(artist.vendorId())
                .artistName(artist.businessName() == null ? "Artist" : artist.businessName())
                .buyerId(buyerId)
                .occasion(blank(request.getOccasion()))
                .serviceType(primaryService)
                .serviceTypes(serviceTypesCsv)
                .venue(venue)
                .status(status)
                .paymentMethod(paymentMethod)
                .paymentStatus(BeautyPaymentStatus.DUE)
                .serviceAmount(servicePrice)
                .travelCharge(travel)
                .platformFeeAmount(platformFee)
                .codFee(codFee)
                .parlourPaymentFee(parlourFee)
                .amountCollected(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .amountDueTotal(amountDueTotal)
                .prepayAmount(payNow)
                .prepayMode(partialRequested ? "PARTIAL" : "FULL")
                .durationMinutes(Math.max(15, totalMinutes))
                .specialInstructions(blank(request.getSpecialInstructions()))
                .referencePhotoMediaId(referencePhotoMediaId)
                .addressId(addressId)
                .addressText(addressText)
                .studioAddress(venue == BeautyVenue.AT_STUDIO ? artist.studioAddress() : null)
                .contactName(contactName)
                .contactPhone(contactPhone)
                .slotStart(request.getSlotStart())
                .slotEnd(request.getSlotEnd())
                .placedAt(now)
                .build();
        order.setCreatedBy(buyerId);
        order.setUpdatedBy(buyerId);
        try {
            orderRepository.save(order);
        } catch (DataIntegrityViolationException ex) {
            if (referencePhotoMediaId != null) {
                throw new BusinessException(ErrorCode.CONFLICT, "This reference photo is already used on another booking");
            }
            throw ex;
        }
        event(order, buyerId, "PLACE", null, order.getStatus().name(), "Booking placed");

        PaymentInfoResponse payment = paymentClient.initiatePayment(
                buyerId,
                order.getId(),
                order.getTownId(),
                request.getPaymentGateway() == null || request.getPaymentGateway().isBlank()
                        ? "RAZORPAY" : request.getPaymentGateway(),
                order.getId() + "-pay",
                order.getContactPhone(),
                payNow,
                order.getOrderNumber(),
                "PAYMENT_PENDING",
                "ONLINE");
        BeautyOrderResponse response = toResponse(order);
        response.setPayment(payment);
        return response;
    }

    @Transactional(readOnly = true)
    public List<BeautyOrderResponse> buyerOrders(UUID buyerId, UUID townId) {
        return orderRepository.findByBuyerIdAndTownIdOrderByPlacedAtDesc(buyerId, townId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public BeautyOrderResponse buyerOrder(UUID buyerId, UUID orderId) {
        BeautyOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking is not yours");
        }
        return toResponse(order);
    }

    @Transactional
    public BeautyOrderResponse buyerCancel(UUID buyerId, UUID orderId) {
        BeautyOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking is not yours");
        }
        return move(order, buyerId, BeautyMove.CANCEL, "Cancelled by customer");
    }

    @Transactional
    public void markOnlinePaid(UUID orderId, UUID buyerId, BigDecimal paidAmountFromGateway) {
        BeautyOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
        boolean awaitingFirst = order.getStatus() == BeautyOrderStatus.AWAITING_PAYMENT;
        boolean balancePay = order.getStatus() == BeautyOrderStatus.CONFIRMED
                && order.getPaymentStatus() == BeautyPaymentStatus.PARTIAL;
        if (!awaitingFirst && !balancePay) {
            return;
        }
        BigDecimal remaining = balanceDue(order);
        BigDecimal increment = moneyOrZero(paidAmountFromGateway);
        if (increment.signum() <= 0) {
            increment = moneyOrZero(order.getPrepayAmount());
        }
        if (increment.signum() <= 0 && awaitingFirst && isPartialPrepay(order)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Could not apply payment — prepay amount missing. Contact support.");
        }
        if (increment.signum() <= 0) {
            increment = remaining;
        }
        if (increment.compareTo(remaining) > 0) {
            increment = remaining;
        }
        BigDecimal collected = moneyOrZero(order.getAmountCollected()).add(increment).setScale(2, RoundingMode.HALF_UP);
        order.setAmountCollected(collected);
        if (awaitingFirst) {
            order.setStatus(BeautyOrderStatus.CONFIRMED);
        }
        if (collected.compareTo(orderTotal(order)) >= 0) {
            order.setPaymentStatus(BeautyPaymentStatus.COLLECTED);
        } else {
            order.setPaymentStatus(BeautyPaymentStatus.PARTIAL);
        }
        order.setUpdatedBy(buyerId);
        orderRepository.save(order);
        String from = awaitingFirst ? BeautyOrderStatus.AWAITING_PAYMENT.name() : order.getStatus().name();
        event(order, buyerId, "PAY", from, order.getStatus().name(),
                collected.compareTo(orderTotal(order)) >= 0 ? "Online payment received" : "Partial prepay received");
    }

    @Transactional
    public void markOnlineFailed(UUID orderId, UUID buyerId) {
        BeautyOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
        if (order.getStatus() != BeautyOrderStatus.AWAITING_PAYMENT) {
            return;
        }
        order.setPaymentStatus(BeautyPaymentStatus.FAILED);
        order.setUpdatedBy(buyerId);
        orderRepository.save(order);
    }

    @Transactional
    public PaymentInfoResponse retryOnlinePayment(UUID buyerId, UUID orderId, String idempotencyKey, String gateway) {
        BeautyOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
        if (order.getPaymentMethod() != BeautyPaymentMethod.UPI) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This booking is not an online payment order");
        }
        BigDecimal remaining = balanceDue(order);
        if (remaining.signum() <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Nothing left to pay on this booking");
        }
        if (order.getStatus() == BeautyOrderStatus.AWAITING_PAYMENT) {
            // first attempt retry
        } else if (order.getStatus() != BeautyOrderStatus.CONFIRMED
                || order.getPaymentStatus() != BeautyPaymentStatus.PARTIAL) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This booking is not waiting for online payment");
        }
        order.setPrepayAmount(remaining);
        order.setUpdatedBy(buyerId);
        orderRepository.save(order);
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? order.getId() + "-pay-" + System.currentTimeMillis() : idempotencyKey;
        return paymentClient.initiatePayment(
                buyerId,
                order.getId(),
                order.getTownId(),
                gateway == null || gateway.isBlank() ? "RAZORPAY" : gateway,
                key,
                order.getContactPhone(),
                remaining,
                order.getOrderNumber(),
                "PAYMENT_PENDING",
                "ONLINE");
    }

    @Transactional(readOnly = true)
    public List<BeautyOrderResponse> vendorOrders(UUID userId) {
        UUID vendorId = vendorBeautyClient.vendorIdForUser(userId);
        return orderRepository.findByVendorIdOrderByPlacedAtDesc(vendorId).stream()
                .filter(order -> order.getStatus() != BeautyOrderStatus.AWAITING_PAYMENT)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public BeautyOrderResponse vendorAct(UUID userId, UUID orderId, BeautyActionRequest request) {
        UUID vendorId = vendorBeautyClient.vendorIdForUser(userId);
        BeautyOrder order = requireOrder(orderId);
        if (!order.getVendorId().equals(vendorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking is for another artist");
        }
        if (order.getStatus() == BeautyOrderStatus.AWAITING_PAYMENT) {
            throw new BusinessException(ErrorCode.CONFLICT, "Waiting for customer payment");
        }
        String action = request.getAction() == null ? "" : request.getAction().trim().toUpperCase();
        BeautyMove move;
        try {
            move = BeautyMove.valueOf(action);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown action");
        }
        return move(order, userId, move, request.getNote());
    }

    @Transactional(readOnly = true)
    public List<BeautyOrderResponse> adminOrders(UUID townId) {
        return orderRepository.findByTownIdOrderByPlacedAtDesc(townId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public BeautyOrderResponse rateBooking(UUID buyerId, UUID orderId, RateBeautyOrderRequest request) {
        BeautyOrder order = orderRepository.findByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Booking not found"));
        if (order.getStatus() != BeautyOrderStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Rate the artist after the booking is completed");
        }
        if (ratingRepository.findByOrderId(orderId).isPresent()) {
            return toResponse(order);
        }
        int stars = request.getStars() == null ? 0 : request.getStars();
        if (stars < 1 || stars > 5) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose 1 to 5 stars");
        }
        String comment = request.getComment() == null ? null : request.getComment().trim();
        if (comment != null && comment.length() > 400) {
            comment = comment.substring(0, 400);
        }
        ratingRepository.save(BeautyOrderRating.builder()
                .orderId(order.getId())
                .buyerId(buyerId)
                .vendorId(order.getVendorId())
                .townId(order.getTownId())
                .stars((short) stars)
                .comment(comment == null || comment.isBlank() ? null : comment)
                .build());
        try {
            scratchCardService.issueIfEligibleAfterBeautyRating(order);
        } catch (Exception ignored) {
            // Rating saved; scratch is best-effort.
        }
        return toResponse(order);
    }

    private BeautyOrderResponse move(BeautyOrder order, UUID actorId, BeautyMove move, String note) {
        BeautyOrderStatus from = order.getStatus();
        BeautyOrderStatus to = BeautyOrderWorkflow.next(order.getVenue(), from, move);
        order.setStatus(to);
        order.setUpdatedBy(actorId);
        if (to == BeautyOrderStatus.COMPLETED) {
            order.setCompletedAt(Instant.now());
            if (order.getPaymentMethod() == BeautyPaymentMethod.CASH
                    && moneyOrZero(order.getAmountCollected()).signum() <= 0) {
                order.setAmountCollected(buyerPayable(order));
                order.setPaymentStatus(BeautyPaymentStatus.COLLECTED);
            }
        }
        orderRepository.save(order);
        event(order, actorId, move.name(), from.name(), to.name(), note);
        return toResponse(order);
    }

    private BeautyOrderResponse toResponse(BeautyOrder order) {
        var existingRating = ratingRepository.findByOrderId(order.getId());
        boolean canRate = order.getStatus() == BeautyOrderStatus.COMPLETED && existingRating.isEmpty();
        BigDecimal collectedOnline = resolveOnlineCollected(order);
        BigDecimal totalDue = orderTotal(order);
        BigDecimal balance = totalDue.subtract(collectedOnline).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        return BeautyOrderResponse.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .townId(order.getTownId())
                .vendorId(order.getVendorId())
                .artistName(order.getArtistName())
                .buyerId(order.getBuyerId())
                .occasion(order.getOccasion())
                .serviceType(order.getServiceType())
                .serviceTypes(order.getServiceTypes())
                .serviceLabel(serviceLabelsForOrder(order))
                .bookedServiceLabels(bookedServiceLabels(order))
                .venue(order.getVenue().name())
                .venueLabel(order.getVenue().label())
                .status(order.getStatus().name())
                .statusLabel(order.getStatus().label())
                .paymentMethod(order.getPaymentMethod().name())
                .paymentStatus(order.getPaymentStatus().name())
                .serviceAmount(order.getServiceAmount())
                .travelCharge(order.getTravelCharge())
                .platformFeeAmount(order.getPlatformFeeAmount())
                .codFee(order.getCodFee())
                .parlourPaymentFee(order.getParlourPaymentFee())
                .amountCollected(collectedOnline)
                .amountDueTotal(totalDue)
                .balanceDue(balance)
                .prepayAmount(order.getPrepayAmount())
                .durationMinutes(order.getDurationMinutes())
                .specialInstructions(order.getSpecialInstructions())
                .referencePhotoMediaId(order.getReferencePhotoMediaId())
                .referencePhotoUrl(order.getReferencePhotoMediaId() == null
                        ? null
                        : "/api/v1/media/" + order.getReferencePhotoMediaId() + "/content")
                .addressText(order.getAddressText())
                .studioAddress(order.getStudioAddress())
                .contactName(order.getContactName())
                .contactPhone(order.getContactPhone())
                .slotStart(order.getSlotStart())
                .slotEnd(order.getSlotEnd())
                .placedAt(order.getPlacedAt())
                .completedAt(order.getCompletedAt())
                .prepayMode(order.getPrepayMode())
                .myRatingStars(existingRating.map(r -> (int) r.getStars()).orElse(null))
                .canRateBooking(canRate)
                .allowedActions(allowedActions(order))
                .build();
    }

    private static List<String> allowedActions(BeautyOrder order) {
        List<String> out = new ArrayList<>();
        BeautyOrderStatus status = order.getStatus();
        if (status == BeautyOrderStatus.CONFIRMED && order.getVenue() == BeautyVenue.AT_HOME) {
            out.add("EN_ROUTE");
        }
        if (status == BeautyOrderStatus.CONFIRMED || status == BeautyOrderStatus.EN_ROUTE) {
            out.add("START");
        }
        if (status == BeautyOrderStatus.IN_SERVICE) {
            out.add("COMPLETE");
        }
        if (status == BeautyOrderStatus.CONFIRMED || status == BeautyOrderStatus.EN_ROUTE) {
            out.add("CANCEL");
        }
        return out;
    }

    private static List<String> resolveServiceTypes(PlaceBeautyOrderRequest request) {
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        if (request.getServiceTypes() != null) {
            for (String raw : request.getServiceTypes()) {
                if (raw != null && !raw.isBlank()) {
                    codes.add(raw.trim().toUpperCase());
                }
            }
        }
        if (codes.isEmpty() && request.getServiceType() != null && !request.getServiceType().isBlank()) {
            codes.add(request.getServiceType().trim().toUpperCase());
        }
        return new ArrayList<>(codes);
    }

    private static List<String> bookedServiceLabels(BeautyOrder order) {
        List<String> codes = bookedServiceCodes(order);
        return codes.stream().map(BeautyOrderService::serviceLabel).toList();
    }

    private static List<String> bookedServiceCodes(BeautyOrder order) {
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        if (order.getServiceTypes() != null && !order.getServiceTypes().isBlank()) {
            for (String raw : order.getServiceTypes().split(",")) {
                if (raw != null && !raw.isBlank()) {
                    codes.add(raw.trim().toUpperCase());
                }
            }
        }
        if (codes.isEmpty() && order.getServiceType() != null && !order.getServiceType().isBlank()) {
            codes.add(order.getServiceType().trim().toUpperCase());
        }
        return new ArrayList<>(codes);
    }

    private static String serviceLabelsForOrder(BeautyOrder order) {
        List<String> labels = bookedServiceLabels(order);
        if (labels.isEmpty()) {
            return serviceLabel(order.getServiceType());
        }
        return String.join(" + ", labels);
    }

    private static String serviceLabel(String id) {
        if (id == null) {
            return "";
        }
        String code = id.trim().toUpperCase();
        return switch (code) {
            case "NATURAL_GLOW" -> "Natural glow";
            case "PARTY_GLAM" -> "Party glam";
            case "HD_CAMERA" -> "HD / camera ready";
            case "BRIDAL_FULL" -> "Bridal makeup";
            case "HAIR_STYLING" -> "Hair styling";
            case "SAREE_DRAPE" -> "Saree drape";
            case "MEHENDI" -> "Mehendi (hands)";
            case "MANICURE" -> "Manicure";
            case "PEDICURE" -> "Pedicure";
            case "FACIAL" -> "Facial";
            case "THREADING" -> "Threading";
            case "WAXING" -> "Waxing";
            default -> code.startsWith("CUS_") ? code.substring(4).replace('_', ' ') : code;
        };
    }

    private void requireTownBeauty(UUID townId) {
        if (!townClient.isBeautyEnabled(townId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Makeup & beauty is not available in this town");
        }
    }

    private BeautyOrder requireOrder(UUID orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Booking not found"));
    }

    private static boolean slotBlocked(
            VendorBeautyClient.BeautyArtistView artist,
            Instant start,
            BeautySlotSchedule schedule) {
        if (artist == null || start == null) {
            return false;
        }
        var when = start.atZone(IST);
        return manualBlocksForDate(artist, when.toLocalDate(), schedule).contains(schedule.idFromInstant(start));
    }

    private static LinkedHashSet<String> manualBlocksForDate(
            VendorBeautyClient.BeautyArtistView artist,
            LocalDate day,
            BeautySlotSchedule schedule) {
        LinkedHashSet<String> blocked = new LinkedHashSet<>();
        if (artist == null || day == null) {
            return blocked;
        }
        blocked.addAll(BeautySlotBlocks.forDate(artist.blockedSlotsByDate(), day, schedule));
        if (!blocked.isEmpty()) {
            return blocked;
        }
        String date = artist.blockedSlotDate();
        String slots = artist.blockedSlotIds();
        if (date == null || date.isBlank() || slots == null || slots.isBlank()) {
            return blocked;
        }
        if (!date.equals(day.toString())) {
            return blocked;
        }
        for (String part : slots.split(",")) {
            String token = part.trim();
            if (token.isEmpty()) {
                continue;
            }
            if (schedule.isValidId(token)) {
                blocked.add(token);
            }
        }
        return blocked;
    }

    private String nextNumber(LocalDate day) {
        BeautyDaySeq seq = daySeqRepository.lockDay(day).orElseGet(() -> {
            BeautyDaySeq created = new BeautyDaySeq();
            created.setDay(day);
            created.setLastNo(0);
            return daySeqRepository.save(created);
        });
        seq.setLastNo(seq.getLastNo() + 1);
        daySeqRepository.save(seq);
        return "G" + DAY.format(day) + "-" + String.format("%04d", seq.getLastNo());
    }

    private void event(BeautyOrder order, UUID actorId, String action, String from, String to, String note) {
        BeautyOrderEvent row = BeautyOrderEvent.builder()
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

    private static BeautyVenue parseVenue(String raw) {
        try {
            return BeautyVenue.valueOf(raw == null ? "" : raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose home or studio");
        }
    }

    private static BeautyPaymentMethod parsePayment(String raw) {
        try {
            return BeautyPaymentMethod.valueOf(raw == null ? "" : raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose UPI for glam bookings");
        }
    }

    private static BigDecimal orderTotal(BeautyOrder order) {
        if (order.getAmountDueTotal() != null && order.getAmountDueTotal().signum() > 0) {
            return moneyOrZero(order.getAmountDueTotal());
        }
        return buyerPayable(order);
    }

    private static BigDecimal balanceDue(BeautyOrder order) {
        return orderTotal(order).subtract(moneyOrZero(order.getAmountCollected())).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveOnlineCollected(BeautyOrder order) {
        BigDecimal fromPayments = paymentClient.sumSuccessfulPaymentsForOrder(order.getId());
        if (fromPayments != null) {
            return fromPayments.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        }
        return moneyOrZero(order.getAmountCollected());
    }

    private static boolean isPartialPrepay(BeautyOrder order) {
        return order.getPrepayMode() != null && "PARTIAL".equalsIgnoreCase(order.getPrepayMode().trim());
    }

    private static BigDecimal resolvePrepayAmount(BigDecimal total, BigDecimal minPrepay, boolean partialRequested) {
        if (total.signum() <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Booking total must be greater than zero");
        }
        if (partialRequested) {
            if (minPrepay.signum() <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Partial prepay is not enabled for this artist — pay in full");
            }
            if (minPrepay.compareTo(total) >= 0) {
                return total;
            }
            return minPrepay.setScale(2, RoundingMode.HALF_UP);
        }
        return total;
    }

    private static BigDecimal buyerPayable(BeautyOrder order) {
        return moneyOrZero(order.getServiceAmount())
                .add(moneyOrZero(order.getTravelCharge()))
                .add(moneyOrZero(order.getPlatformFeeAmount()))
                .add(moneyOrZero(order.getCodFee()))
                .add(moneyOrZero(order.getParlourPaymentFee()));
    }

    private static BigDecimal moneyOrZero(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private void assertReferencePhoto(UUID photoId, UUID buyerId) {
        if (orderRepository.existsByReferencePhotoMediaId(photoId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "This reference photo is already used on another booking");
        }
        MediaClient.MediaMeta meta = mediaClient.meta(photoId);
        if (meta.ownerUserId() == null || !meta.ownerUserId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Photo does not belong to this customer");
        }
        if (!"BEAUTY_REFERENCE".equals(meta.context())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Photo must be a beauty reference photo");
        }
    }

    private static String blank(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String text(Object raw) {
        return raw == null ? null : String.valueOf(raw).trim();
    }

    private static String addressText(Map<String, Object> address) {
        if (address == null) {
            return "";
        }
        String line1 = text(address.get("line1"));
        String line2 = text(address.get("line2"));
        String city = text(address.get("city"));
        String pin = text(address.get("pincode"));
        return String.join(", ", java.util.stream.Stream.of(line1, line2, city, pin)
                .filter(part -> part != null && !part.isBlank())
                .toList());
    }
}
