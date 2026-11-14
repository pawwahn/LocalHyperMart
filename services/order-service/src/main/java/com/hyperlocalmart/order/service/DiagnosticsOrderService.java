package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.common.util.GeoDistance;
import com.hyperlocalmart.common.util.IndianMobilePhones;
import com.hyperlocalmart.common.util.SlotBlocksByDate;
import com.hyperlocalmart.order.client.AddressClient;
import com.hyperlocalmart.order.client.MediaClient;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PatientClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.client.VendorDiagnosticsClient;
import com.hyperlocalmart.order.diagnostics.DiagnosticsMove;
import com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus;
import com.hyperlocalmart.order.diagnostics.DiagnosticsOrderWorkflow;
import com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod;
import com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsActionRequest;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsLabCard;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsShopDetail;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsOrderResponse;
import com.hyperlocalmart.order.dto.diagnostics.PlaceDiagnosticsOrderRequest;
import com.hyperlocalmart.order.dto.response.OrderInternalSnapshotResponse;
import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import com.hyperlocalmart.order.entity.DiagnosticsDaySeq;
import com.hyperlocalmart.order.entity.DiagnosticsOrder;
import com.hyperlocalmart.order.entity.DiagnosticsOrderEvent;
import com.hyperlocalmart.order.entity.DiagnosticsOrderLine;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.repository.DiagnosticsDaySeqRepository;
import com.hyperlocalmart.order.repository.DiagnosticsOrderEventRepository;
import com.hyperlocalmart.order.repository.DiagnosticsOrderLineRepository;
import com.hyperlocalmart.order.repository.DiagnosticsOrderRepository;
import com.hyperlocalmart.order.service.invoice.DiagnosticsReportPdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.StringJoiner;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

@Service
@RequiredArgsConstructor
public class DiagnosticsOrderService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyMMdd");
    private static final int MAX_SAMPLE_PHOTOS = 5;
    private static final int MAX_REPORT_ATTACHMENTS = 5;

    private final DiagnosticsOrderRepository orderRepository;
    private final DiagnosticsOrderLineRepository lineRepository;
    private final DiagnosticsOrderEventRepository eventRepository;
    private final DiagnosticsDaySeqRepository daySeqRepository;
    private final TownClient townClient;
    private final VendorDiagnosticsClient vendorDiagnosticsClient;
    private final PatientClient patientClient;
    private final AddressClient addressClient;
    private final PaymentClient paymentClient;
    private final MediaClient mediaClient;
    private final NotificationClient notificationClient;
    private final DiagnosticsReportPdfService reportPdfService;
    private final TransactionTemplate transactionTemplate;

    @Transactional(readOnly = true)
    public List<DiagnosticsLabCard> shops(UUID townId) {
        requireTownDiagnostics(townId);
        return vendorDiagnosticsClient.bookableLabs(townId).stream()
                .map(lab -> DiagnosticsLabCard.builder()
                        .vendorId(lab.vendorId())
                        .businessName(lab.businessName())
                        .phone(lab.phone())
                        .homeCollectionFee(money(lab.homeCollectionFee()))
                        .activeBranchCount(lab.activeBranchCount())
                        .tests(lab.tests() == null ? List.of() : lab.tests().stream()
                                .map(t -> DiagnosticsLabCard.TestCard.builder()
                                        .id(t.id())
                                        .code(t.code())
                                        .name(t.name())
                                        .price(money(t.price()))
                                        .fastingNote(t.fastingNote())
                                        .prescriptionRequired(t.prescriptionRequired())
                                        .homeCollection(t.homeCollection())
                                        .build())
                                .toList())
                        .packages(mapBuyerPackagesFromLabView(lab))
                        .build())
                .filter(card -> (card.getTests() != null && !card.getTests().isEmpty())
                        || (card.getPackages() != null && !card.getPackages().isEmpty()))
                .toList();
    }

    @Transactional(readOnly = true)
    public DiagnosticsShopDetail shopDetail(UUID buyerId, UUID townId, UUID vendorId, UUID addressId) {
        requireTownDiagnostics(townId);
        Map<String, Object> address = addressClient.getAddressSnapshot(addressId, buyerId, townId);
        VendorDiagnosticsClient.DiagnosticsLabDetailView lab;
        try {
            lab = vendorDiagnosticsClient.lab(vendorId);
        } catch (BusinessException ex) {
            return DiagnosticsShopDetail.builder()
                    .vendorId(vendorId)
                    .eligible(false)
                    .ineligibleReason(ex.getMessage())
                    .build();
        }
        if (lab.townId() == null || !lab.townId().equals(townId)) {
            return DiagnosticsShopDetail.builder()
                    .vendorId(vendorId)
                    .businessName(lab.businessName())
                    .eligible(false)
                    .ineligibleReason("This lab is not in your town")
                    .build();
        }
        VendorDiagnosticsClient.BranchView branch;
        try {
            branch = resolveServingBranch(lab, address);
        } catch (BusinessException ex) {
            return DiagnosticsShopDetail.builder()
                    .vendorId(vendorId)
                    .businessName(lab.businessName())
                    .homeCollectionFee(money(lab.homeCollectionFee()))
                    .eligible(false)
                    .ineligibleReason(ex.getMessage())
                    .tests(mapBuyerTests(lab))
                    .packages(mapBuyerPackages(lab))
                    .build();
        }
        List<DiagnosticsShopDetail.DiagnosticsSlotCard> slots = new ArrayList<>();
        if (branch.slots() != null) {
            for (VendorDiagnosticsClient.SlotView slot : branch.slots()) {
                if (!slot.active()) {
                    continue;
                }
                slots.add(DiagnosticsShopDetail.DiagnosticsSlotCard.builder()
                        .slotId(slot.id())
                        .label(slot.label())
                        .start(slot.startTime())
                        .end(slot.endTime())
                        .capacity(slot.capacity())
                        .build());
            }
        }
        return DiagnosticsShopDetail.builder()
                .vendorId(vendorId)
                .businessName(lab.businessName())
                .homeCollectionFee(money(lab.homeCollectionFee()))
                .eligible(true)
                .servingBranchId(branch.id())
                .servingBranchLabel(branch.label())
                .blockedSlotsByDate(mergeBlockedSlotsForBuyer(branch, lab))
                .tests(mapBuyerTests(lab))
                .packages(mapBuyerPackages(lab))
                .slots(slots)
                .build();
    }

    private static List<DiagnosticsLabCard.TestCard> mapBuyerTests(VendorDiagnosticsClient.DiagnosticsLabDetailView lab) {
        if (lab.tests() == null) {
            return List.of();
        }
        return lab.tests().stream()
                .filter(VendorDiagnosticsClient.TestView::active)
                .map(t -> DiagnosticsLabCard.TestCard.builder()
                        .id(t.id())
                        .code(t.code())
                        .name(t.name())
                        .price(money(t.price()))
                        .fastingNote(t.fastingNote())
                        .prescriptionRequired(t.prescriptionRequired())
                        .homeCollection(t.homeCollection())
                        .build())
                .toList();
    }

    private static List<DiagnosticsLabCard.PackageCard> mapBuyerPackagesFromLabView(
            VendorDiagnosticsClient.DiagnosticsLabView lab) {
        return mapBuyerPackageCards(lab.tests(), lab.packages());
    }

    private static List<DiagnosticsLabCard.PackageCard> mapBuyerPackages(
            VendorDiagnosticsClient.DiagnosticsLabDetailView lab) {
        return mapBuyerPackageCards(lab.tests(), lab.packages());
    }

    private static List<DiagnosticsLabCard.PackageCard> mapBuyerPackageCards(
            List<VendorDiagnosticsClient.TestView> tests,
            List<VendorDiagnosticsClient.PackageView> packages) {
        if (packages == null || packages.isEmpty()) {
            return List.of();
        }
        java.util.Set<UUID> activeTestIds = tests == null
                ? java.util.Set.of()
                : tests.stream()
                        .filter(VendorDiagnosticsClient.TestView::active)
                        .map(VendorDiagnosticsClient.TestView::id)
                        .collect(java.util.stream.Collectors.toSet());
        return packages.stream()
                .filter(VendorDiagnosticsClient.PackageView::active)
                .filter(p -> p.testIds() != null && !p.testIds().isEmpty())
                .filter(p -> p.price() != null && p.price().signum() > 0)
                .filter(p -> p.testIds().stream().allMatch(activeTestIds::contains))
                .map(p -> DiagnosticsLabCard.PackageCard.builder()
                        .id(p.id())
                        .code(p.code())
                        .name(p.name())
                        .description(p.description())
                        .price(money(p.price()))
                        .testIds(p.testIds())
                        .build())
                .toList();
    }

    public DiagnosticsOrderResponse place(UUID buyerId, String buyerPhone, PlaceDiagnosticsOrderRequest request) {
        DiagnosticsPaymentMethod paymentMethod = parsePayment(request.getPaymentMethod());
        BookingInputs inputs = loadBookingInputs(buyerId, request, paymentMethod == DiagnosticsPaymentMethod.UPI);
        if (!inputs.diagnosticsEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Diagnostics is not enabled in this town");
        }
        TownClient.DiagnosticsSettings settings = inputs.settings();
        VendorDiagnosticsClient.DiagnosticsLabDetailView lab = inputs.lab();
        if (!lab.enabled() || !lab.bookable() || !"ACTIVE".equalsIgnoreCase(lab.vendorStatus())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This lab is not taking bookings");
        }
        if (lab.townId() == null || !lab.townId().equals(request.getTownId())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This lab is not in the selected town");
        }
        PatientClient.PatientView patient = inputs.patient();
        Map<String, Object> address = inputs.address();
        String referenceType = normalizeReference(request.getReferenceType());
        if ("DOCTOR".equals(referenceType)
                && (request.getReferringDoctorName() == null || request.getReferringDoctorName().isBlank())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Doctor name is required for doctor reference");
        }
        if (request.getSlotStart() == null || request.getSlotEnd() == null
                || !request.getSlotEnd().isAfter(request.getSlotStart())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose a valid collection slot");
        }
        Instant nowPlacement = Instant.now();
        if (!request.getSlotEnd().isAfter(nowPlacement)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "That collection window has ended — pick a future time");
        }
        if (paymentMethod == DiagnosticsPaymentMethod.COD) {
            if (!settings.codEnabled()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "COD is not available for diagnostics in this town");
            }
        } else if (inputs.paymentSettings() == null || !inputs.paymentSettings().upiEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Online payment is not available in this town");
        }
        VendorDiagnosticsClient.BranchView branch = resolveServingBranch(lab, address);
        validateSlotBooking(lab, branch, request.getSlotStart(), request.getSlotTemplateId());
        CartResolution cart = resolveCart(lab, request.getTestIds(), request.getPackageIds());
        BigDecimal testsSubtotal = cart.subtotal();
        if (testsSubtotal.signum() <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose at least one test or package");
        }
        BigDecimal homeFee = money(lab.homeCollectionFee());
        BigDecimal platformFee = money(settings.platformFeeFlat());
        BigDecimal codFee = paymentMethod == DiagnosticsPaymentMethod.COD ? money(settings.codSurchargeAmount()) : BigDecimal.ZERO;
        BigDecimal total = testsSubtotal.add(homeFee).add(platformFee).add(codFee).setScale(2, RoundingMode.HALF_UP);
        String contactPhone = IndianMobilePhones.firstTenDigit(
                request.getContactPhone(),
                String.valueOf(address.get("recipientPhone")),
                buyerPhone);
        DiagnosticsOrder order = transactionTemplate.execute(status -> persistPlacedOrder(
                buyerId, request, paymentMethod, lab, patient, branch, address, referenceType, contactPhone,
                testsSubtotal, homeFee, platformFee, codFee, cart));
        if (order == null) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not save booking");
        }
        DiagnosticsOrderResponse response = toResponse(order, true, null);
        if (paymentMethod != DiagnosticsPaymentMethod.UPI) {
            notifyDiagnosticsBuyer(order, order.getStatus().label());
            return response;
        }
        String payPhone = IndianMobilePhones.firstTenDigit(contactPhone, buyerPhone);
        if (payPhone == null) {
            abandonUnpaid(order.getId(), buyerId);
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "A 10-digit mobile number is required for UPI");
        }
        try {
            PaymentInfoResponse payment = paymentClient.initiatePayment(
                    buyerId,
                    order.getId(),
                    order.getTownId(),
                    request.getPaymentGateway() == null || request.getPaymentGateway().isBlank()
                            ? "RAZORPAY"
                            : request.getPaymentGateway(),
                    order.getId() + "-pay",
                    payPhone,
                    total,
                    order.getOrderNumber(),
                    "PAYMENT_PENDING",
                    "ONLINE");
            response.setPayment(payment);
            response.setAmountCollected(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            return response;
        } catch (RuntimeException ex) {
            abandonUnpaid(order.getId(), buyerId);
            throw ex;
        }
    }

    /**
     * Lab, patient, address, and town flags are independent. One slow call used to delay every later call.
     */
    private BookingInputs loadBookingInputs(UUID buyerId, PlaceDiagnosticsOrderRequest request, boolean online) {
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<TownClient.DiagnosticsSettings> settingsF =
                    executor.submit(() -> townClient.getDiagnosticsSettings(request.getTownId()));
            Future<VendorDiagnosticsClient.DiagnosticsLabDetailView> labF =
                    executor.submit(() -> vendorDiagnosticsClient.lab(request.getVendorId()));
            Future<PatientClient.PatientView> patientF =
                    executor.submit(() -> patientClient.getPatient(buyerId, request.getPatientProfileId()));
            Future<Map<String, Object>> addressF = executor.submit(() ->
                    addressClient.getAddressSnapshot(request.getAddressId(), buyerId, request.getTownId()));
            Future<TownClient.PaymentSettings> payF = online
                    ? executor.submit(() -> townClient.getPaymentSettings(request.getTownId()))
                    : null;
            TownClient.DiagnosticsSettings settings = join(settingsF);
            return new BookingInputs(
                    settings.enabled(),
                    settings,
                    join(labF),
                    join(patientF),
                    join(addressF),
                    payF == null ? null : join(payF));
        }
    }

    private DiagnosticsOrder persistPlacedOrder(
            UUID buyerId,
            PlaceDiagnosticsOrderRequest request,
            DiagnosticsPaymentMethod paymentMethod,
            VendorDiagnosticsClient.DiagnosticsLabDetailView lab,
            PatientClient.PatientView patient,
            VendorDiagnosticsClient.BranchView branch,
            Map<String, Object> address,
            String referenceType,
            String contactPhone,
            BigDecimal testsSubtotal,
            BigDecimal homeFee,
            BigDecimal platformFee,
            BigDecimal codFee,
            CartResolution cart) {
        Instant now = Instant.now();
        DiagnosticsOrderStatus status = paymentMethod == DiagnosticsPaymentMethod.UPI
                ? DiagnosticsOrderStatus.AWAITING_PAYMENT
                : DiagnosticsOrderStatus.BOOKED;
        DiagnosticsOrder order = DiagnosticsOrder.builder()
                .orderNumber(nextNumber(LocalDate.now(IST)))
                .townId(request.getTownId())
                .vendorId(lab.vendorId())
                .shopName(lab.businessName())
                .buyerId(buyerId)
                .patientProfileId(patient.id())
                .patientName(patient.displayName())
                .referenceType(referenceType)
                .referringDoctorName(blank(request.getReferringDoctorName()))
                .servingBranchId(branch.id())
                .servingBranchLabel(branch.label())
                .status(status)
                .paymentMethod(paymentMethod)
                .paymentStatus(DiagnosticsPaymentStatus.PENDING)
                .testsSubtotal(testsSubtotal)
                .homeCollectionFee(homeFee)
                .platformFeeAmount(platformFee)
                .codFee(codFee)
                .amountCollected(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .addressId(request.getAddressId())
                .addressText(formatAddress(address))
                .contactName(String.valueOf(address.get("recipientName")))
                .contactPhone(contactPhone)
                .slotStart(request.getSlotStart())
                .slotEnd(request.getSlotEnd())
                .placedAt(now)
                .build();
        order.setCreatedBy(buyerId);
        order.setUpdatedBy(buyerId);
        orderRepository.save(order);
        for (CartLine cartLine : cart.lines()) {
            DiagnosticsOrderLine line = DiagnosticsOrderLine.builder()
                    .orderId(order.getId())
                    .testId(cartLine.testId())
                    .packageId(cartLine.packageId())
                    .packageName(cartLine.packageName())
                    .testName(cartLine.testName())
                    .unitPrice(money(cartLine.unitPrice()))
                    .build();
            line.setCreatedBy(buyerId);
            line.setUpdatedBy(buyerId);
            lineRepository.save(line);
        }
        event(order, buyerId, null, "PLACED", null, order.getStatus().name(), "Diagnostics booking placed");
        return order;
    }

    /** Drop a booking when checkout never starts, so the slot is not held. */
    private void abandonUnpaid(UUID orderId, UUID buyerId) {
        transactionTemplate.executeWithoutResult(status -> {
            DiagnosticsOrder order = orderRepository.findById(orderId).orElse(null);
            if (order == null || order.getStatus() != DiagnosticsOrderStatus.AWAITING_PAYMENT) {
                return;
            }
            String from = order.getStatus().name();
            order.setStatus(DiagnosticsOrderStatus.CANCELLED);
            order.setUpdatedBy(buyerId);
            orderRepository.save(order);
            event(order, buyerId, null, "PAYMENT_START_FAILED", from, order.getStatus().name(),
                    "Online payment did not start");
        });
    }

    private static <T> T join(Future<T> future) {
        try {
            return future.get();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Booking was interrupted");
        } catch (ExecutionException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof RuntimeException runtime) {
                throw runtime;
            }
            throw new IllegalStateException(cause == null ? ex : cause);
        }
    }

    private record BookingInputs(
            boolean diagnosticsEnabled,
            TownClient.DiagnosticsSettings settings,
            VendorDiagnosticsClient.DiagnosticsLabDetailView lab,
            PatientClient.PatientView patient,
            Map<String, Object> address,
            TownClient.PaymentSettings paymentSettings) {
    }

    /**
     * New checkout attempt for diagnostics when the buyer still owes online payment.
     */
    @Transactional
    public PaymentInfoResponse retryOnlinePayment(
            UUID buyerId, String buyerPhone, UUID orderId, String idempotencyKey, String gateway) {
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking is not yours");
        }
        if (order.getPaymentMethod() != DiagnosticsPaymentMethod.UPI) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This booking is not an online payment order");
        }
        if (order.getStatus() != DiagnosticsOrderStatus.AWAITING_PAYMENT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This booking is not waiting for online payment");
        }
        BigDecimal total = orderTotal(order);
        String payPhone = IndianMobilePhones.firstTenDigit(order.getContactPhone(), buyerPhone);
        if (payPhone == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "A 10-digit mobile number is required for UPI");
        }
        String key = idempotencyKey == null || idempotencyKey.isBlank()
                ? order.getId() + "-pay-" + System.currentTimeMillis()
                : idempotencyKey;
        return paymentClient.initiatePayment(
                buyerId,
                order.getId(),
                order.getTownId(),
                gateway == null || gateway.isBlank() ? "RAZORPAY" : gateway,
                key,
                payPhone,
                total,
                order.getOrderNumber(),
                "PAYMENT_PENDING",
                "ONLINE");
    }

    @Transactional(readOnly = true)
    public List<DiagnosticsOrderResponse> buyerOrders(UUID buyerId, UUID townId) {
        return orderRepository.findByBuyerIdAndTownIdOrderByPlacedAtDesc(buyerId, townId).stream()
                .map(o -> toResponse(o, false, null))
                .toList();
    }

    @Transactional(readOnly = true)
    public DiagnosticsOrderResponse buyerOrder(UUID buyerId, UUID orderId) {
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking is not yours");
        }
        return toResponse(order, true, null);
    }

    @Transactional(readOnly = true)
    public byte[] buyerReportPdf(UUID buyerId, UUID orderId) {
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking is not yours");
        }
        return reportPdf(order);
    }

    @Transactional(readOnly = true)
    public MediaClient.MediaBytes buyerReportAttachment(UUID buyerId, UUID orderId, UUID mediaId) {
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking is not yours");
        }
        boolean attached = reportAttachmentRows(order).stream().anyMatch(row -> row.mediaId().equals(mediaId));
        if (!attached) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Report file not found on this booking");
        }
        return mediaClient.loadContent(mediaId);
    }

    @Transactional(readOnly = true)
    public byte[] vendorReportPdf(UUID userId, UUID orderId) {
        VendorDiagnosticsClient.StaffContextView ctx = vendorDiagnosticsClient.staffContext(userId);
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getVendorId().equals(ctx.vendorId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking belongs to another lab");
        }
        return reportPdf(order);
    }

    private byte[] reportPdf(DiagnosticsOrder order) {
        List<DiagnosticsOrderLine> lines = lineRepository.findByOrderIdOrderByTestNameAsc(order.getId());
        return reportPdfService.generate(order, lines);
    }

    @Transactional
    public DiagnosticsOrderResponse buyerCancel(UUID buyerId, UUID orderId) {
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking is not yours");
        }
        if (order.getStatus() != DiagnosticsOrderStatus.BOOKED
                && order.getStatus() != DiagnosticsOrderStatus.AWAITING_PAYMENT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cancel is only allowed before an agent is assigned");
        }
        if (order.getPaymentMethod() == DiagnosticsPaymentMethod.UPI
                && order.getPaymentStatus() == DiagnosticsPaymentStatus.PAID) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This booking cannot be cancelled after payment");
        }
        DiagnosticsActionRequest cancel = new DiagnosticsActionRequest();
        cancel.setNote("Cancelled by customer");
        return move(order, buyerId, null, DiagnosticsMove.CANCEL, cancel, null);
    }

    @Transactional(readOnly = true)
    public List<DiagnosticsOrderResponse> vendorOrders(UUID userId) {
        UUID vendorId = vendorDiagnosticsClient.vendorIdForUser(userId);
        VendorDiagnosticsClient.StaffContextView ctx = vendorDiagnosticsClient.staffContext(userId);
        return orderRepository.findByVendorIdOrderByPlacedAtDesc(vendorId).stream()
                .filter(DiagnosticsOrderService::visibleOnVendorScreen)
                .map(o -> toResponse(o, true, ctx))
                .toList();
    }

    private static final List<DiagnosticsOrderStatus> COLLECTOR_HISTORY_STATUSES = List.of(
            DiagnosticsOrderStatus.REPORT_FINALIZED,
            DiagnosticsOrderStatus.COMPLETED);

    @Transactional(readOnly = true)
    public long collectorVisitHistoryCount(UUID userId) {
        UUID staffId = requireCollectorStaffId(userId);
        if (staffId == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Staff login required");
        }
        return orderRepository.countByAssignedStaffIdAndStatusIn(staffId, COLLECTOR_HISTORY_STATUSES);
    }

    @Transactional(readOnly = true)
    public List<DiagnosticsOrderResponse> collectorVisitHistory(
            UUID userId, LocalDate from, LocalDate to, String search) {
        if (to.isBefore(from)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid date range");
        }
        if (from.plusDays(62).isBefore(to)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Pick a range of 62 days or less");
        }
        UUID staffId = requireCollectorStaffId(userId);
        if (staffId == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Staff login required");
        }
        VendorDiagnosticsClient.StaffContextView ctx = vendorDiagnosticsClient.staffContext(userId);
        Instant fromInstant = from.atStartOfDay(IST).toInstant();
        Instant toExclusive = to.plusDays(1).atStartOfDay(IST).toInstant();
        String q = search == null ? "" : search.trim().toLowerCase();
        return orderRepository
                .findCollectorHistory(staffId, COLLECTOR_HISTORY_STATUSES, fromInstant, toExclusive)
                .stream()
                .filter(DiagnosticsOrderService::visibleOnVendorScreen)
                .filter(o -> q.isEmpty() || matchesHistorySearch(o, q))
                .limit(250)
                .map(o -> toResponse(o, true, ctx))
                .toList();
    }

    private UUID requireCollectorStaffId(UUID userId) {
        VendorDiagnosticsClient.StaffContextView ctx = vendorDiagnosticsClient.staffContext(userId);
        if (ctx.staffId() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Staff login required");
        }
        if (!ctx.collectionCapable()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Collection access only");
        }
        return ctx.staffId();
    }

    private static boolean matchesHistorySearch(DiagnosticsOrder order, String q) {
        return containsIgnoreCase(order.getOrderNumber(), q)
                || containsIgnoreCase(order.getPatientName(), q)
                || containsIgnoreCase(order.getContactPhone(), q);
    }

    private static boolean containsIgnoreCase(String value, String q) {
        return value != null && value.toLowerCase().contains(q);
    }

    /** COD stays on the vendor queue. Online bookings appear only after payment is captured. */
    private static boolean visibleOnVendorScreen(DiagnosticsOrder order) {
        if (order.getPaymentMethod() == DiagnosticsPaymentMethod.COD) {
            return true;
        }
        DiagnosticsPaymentStatus pay = order.getPaymentStatus();
        return pay == DiagnosticsPaymentStatus.PAID || pay == DiagnosticsPaymentStatus.COLLECTED;
    }

    @Transactional
    public DiagnosticsOrderResponse vendorAct(UUID userId, UUID orderId, DiagnosticsActionRequest request) {
        VendorDiagnosticsClient.StaffContextView ctx = vendorDiagnosticsClient.staffContext(userId);
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getVendorId().equals(ctx.vendorId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This booking belongs to another lab");
        }
        if (request.getAction() != null && "ADD_SAMPLE_PHOTO".equalsIgnoreCase(request.getAction().trim())) {
            guardSamplePhoto(ctx, order);
            if (request.getMediaId() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "mediaId is required");
            }
            List<UUID> photos = samplePhotoIds(order);
            if (photos.size() >= MAX_SAMPLE_PHOTOS) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Maximum 5 sample photos per visit");
            }
            if (!photos.contains(request.getMediaId())) {
                photos.add(request.getMediaId());
            }
            order.setSamplePhotoMediaIds(joinMediaIds(photos));
            order.setUpdatedBy(userId);
            orderRepository.save(order);
            event(order, userId, ctx.staffId(), "SAMPLE_PHOTO", order.getStatus().name(), order.getStatus().name(),
                    request.getMediaId().toString());
            return toResponse(order, true, ctx);
        }
        if (request.getAction() != null && "REMOVE_SAMPLE_PHOTO".equalsIgnoreCase(request.getAction().trim())) {
            guardSamplePhoto(ctx, order);
            if (request.getMediaId() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "mediaId is required");
            }
            List<UUID> photos = samplePhotoIds(order);
            if (!photos.remove(request.getMediaId())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That photo is not on this visit");
            }
            order.setSamplePhotoMediaIds(joinMediaIds(photos));
            order.setUpdatedBy(userId);
            orderRepository.save(order);
            event(order, userId, ctx.staffId(), "REMOVE_SAMPLE_PHOTO", order.getStatus().name(), order.getStatus().name(),
                    request.getMediaId().toString());
            return toResponse(order, true, ctx);
        }
        if (request.getAction() != null && "ADD_REPORT_ATTACHMENT".equalsIgnoreCase(request.getAction().trim())) {
            return addReportAttachment(ctx, order, userId, request);
        }
        if (request.getAction() != null && "REMOVE_REPORT_ATTACHMENT".equalsIgnoreCase(request.getAction().trim())) {
            return removeReportAttachment(ctx, order, userId, request);
        }
        if (request.getAction() != null && "CONFIRM_SAMPLES_RECEIVED".equalsIgnoreCase(request.getAction().trim())) {
            guardLabBench(ctx, order);
            if (order.getSamplesBenchConfirmedAt() != null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Samples already confirmed for this patient");
            }
            if (!isBenchOpenStatus(order.getStatus())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Confirm samples only while the bag is on the lab bench");
            }
            order.setSamplesBenchConfirmedAt(Instant.now());
            order.setUpdatedBy(userId);
            orderRepository.save(order);
            String patient = order.getPatientName() == null ? "patient" : order.getPatientName().trim();
            event(order, userId, ctx.staffId(), "CONFIRM_SAMPLES_RECEIVED", order.getStatus().name(),
                    order.getStatus().name(), "Samples received for " + patient);
            notifyDiagnosticsBuyer(order, "Samples received at lab");
            return toResponse(order, true, ctx);
        }
        DiagnosticsMove move = parseMove(request.getAction());
        guardVendorMove(ctx, order, move);
        if (move == DiagnosticsMove.START_COLLECTION) {
            preventConcurrentVisit(order, ctx);
        }
        if (move == DiagnosticsMove.SAMPLES_COLLECTED && samplePhotoIds(order).isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Upload at least 1 sample photo before marking samples collected");
        }
        if (move == DiagnosticsMove.ASSIGN) {
            if (request.getAssignedStaffId() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "assignedStaffId is required");
            }
            if (order.getStatus() == DiagnosticsOrderStatus.AWAITING_PAYMENT) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Assign after online payment is confirmed");
            }
            if (order.getPaymentMethod() == DiagnosticsPaymentMethod.UPI
                    && order.getPaymentStatus() != DiagnosticsPaymentStatus.PAID) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Assign after online payment is confirmed");
            }
            order.setAssignedStaffId(request.getAssignedStaffId());
            String incomingName = request.getAssignedStaffName();
            order.setAssignedStaffName(incomingName == null || incomingName.isBlank() ? null : incomingName.trim());
        }
        if (move == DiagnosticsMove.RECEIVED_AT_LAB) {
            if (request.getReceivedByStaffId() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Select who is receiving the sample at the lab");
            }
            order.setReceivedByStaffId(request.getReceivedByStaffId());
            String receivedName = request.getReceivedByStaffName();
            order.setReceivedByStaffName(receivedName == null || receivedName.isBlank() ? null : receivedName.trim());
            if (order.getSamplesReceivedAtLabAt() == null) {
                order.setSamplesReceivedAtLabAt(Instant.now());
            }
            if (request.getNote() == null || request.getNote().isBlank()) {
                String who = order.getReceivedByStaffName() == null ? "lab staff" : order.getReceivedByStaffName();
                request.setNote("Handed to " + who + " at " + Instant.now());
            }
        }
        if (move == DiagnosticsMove.SET_REPORT_ETA && request.getReportEta() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "reportEta is required");
        }
        if (move == DiagnosticsMove.SET_REPORT_ETA) {
            order.setReportEta(request.getReportEta());
        }
        if (move == DiagnosticsMove.UPDATE_RESULTS && request.getLineResults() != null) {
            applyLineResults(order.getId(), request.getLineResults(), userId);
        }
        if (move == DiagnosticsMove.MARK_COD_RECEIVED) {
            BigDecimal collected = money(request.getCodAmountCollected());
            if (collected.signum() <= 0) {
                collected = orderTotal(order);
            }
            order.setAmountCollected(collected.min(orderTotal(order)));
            order.setPaymentStatus(DiagnosticsPaymentStatus.COLLECTED);
        }
        if (move == DiagnosticsMove.FINALIZE) {
            if (order.getSamplesBenchConfirmedAt() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Confirm samples received for the patient before finalizing");
            }
            if (reportAttachmentRows(order).isEmpty()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Upload at least one report file before finalizing");
            }
            order.setReportFinalizedAt(Instant.now());
        }
        if (move == DiagnosticsMove.REOPEN) {
            if (!ctx.vendorOwner() && !"LAB_ADMIN".equalsIgnoreCase(ctx.roleType())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Only lab admin can reopen a finalized report");
            }
            if (request.getNote() == null || request.getNote().isBlank()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Reopen reason is required");
            }
            order.setReportFinalizedAt(null);
            order.setSamplesBenchConfirmedAt(null);
        }
        return move(order, userId, ctx.staffId(), move, request, ctx);
    }

    @Transactional(readOnly = true)
    public Optional<OrderInternalSnapshotResponse> internalLookupSnapshot(UUID orderId) {
        return orderRepository.findById(orderId).map(this::internalLookupSnapshot);
    }

    @Transactional(readOnly = true)
    public Optional<OrderInternalSnapshotResponse> internalLookupSnapshotByNumber(String orderNumber) {
        if (orderNumber == null || orderNumber.isBlank()) {
            return Optional.empty();
        }
        return orderRepository.findByOrderNumber(orderNumber.trim()).map(this::internalLookupSnapshot);
    }

    @Transactional(readOnly = true)
    public Optional<OrderInternalSnapshotResponse> paymentOrderSnapshot(UUID orderId, UUID buyerId) {
        return orderRepository.findById(orderId)
                .filter(order -> order.getBuyerId().equals(buyerId))
                .map(order -> internalLookupSnapshot(order));
    }

    @Transactional
    public void markOnlinePaid(UUID orderId, UUID buyerId, BigDecimal capturedAmount) {
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
        if (order.getStatus() != DiagnosticsOrderStatus.AWAITING_PAYMENT) {
            return;
        }
        BigDecimal increment = money(capturedAmount);
        if (increment.signum() <= 0) {
            increment = orderTotal(order);
        }
        BigDecimal verified = paymentClient.sumSuccessfulPaymentsForOrder(order.getId());
        if (verified != null && verified.signum() > 0) {
            increment = verified.min(orderTotal(order));
        }
        order.setAmountCollected(increment.setScale(2, RoundingMode.HALF_UP));
        order.setPaymentStatus(DiagnosticsPaymentStatus.PAID);
        order.setStatus(DiagnosticsOrderStatus.BOOKED);
        order.setUpdatedBy(buyerId);
        orderRepository.save(order);
        event(order, buyerId, null, "PAY", DiagnosticsOrderStatus.AWAITING_PAYMENT.name(),
                DiagnosticsOrderStatus.BOOKED.name(), "Online payment received");
        notifyDiagnosticsBuyer(order, DiagnosticsOrderStatus.BOOKED.label());
    }

    @Transactional
    public void markOnlineFailed(UUID orderId, UUID buyerId) {
        DiagnosticsOrder order = requireOrder(orderId);
        if (!order.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This order is not yours");
        }
        if (order.getStatus() != DiagnosticsOrderStatus.AWAITING_PAYMENT) {
            return;
        }
        order.setPaymentStatus(DiagnosticsPaymentStatus.FAILED);
        order.setUpdatedBy(buyerId);
        orderRepository.save(order);
    }

    private OrderInternalSnapshotResponse internalLookupSnapshot(DiagnosticsOrder order) {
        OrderStatus status = order.getStatus() == DiagnosticsOrderStatus.AWAITING_PAYMENT
                ? OrderStatus.PAYMENT_PENDING
                : OrderStatus.PLACED;
        PaymentStatus paymentStatus = order.getStatus() == DiagnosticsOrderStatus.AWAITING_PAYMENT
                ? PaymentStatus.PENDING
                : PaymentStatus.PAID;
        PaymentMethod method = order.getPaymentMethod() == DiagnosticsPaymentMethod.UPI
                ? PaymentMethod.ONLINE
                : PaymentMethod.COD;
        return OrderInternalSnapshotResponse.builder()
                .orderId(order.getId())
                .buyerId(order.getBuyerId())
                .townId(order.getTownId())
                .orderNumber(order.getOrderNumber())
                .status(status)
                .paymentStatus(paymentStatus)
                .paymentMethod(method)
                .totalAmount(orderTotal(order))
                .buyerPhone(order.getContactPhone())
                .build();
    }

    private DiagnosticsOrderResponse move(
            DiagnosticsOrder order,
            UUID actorUserId,
            UUID actorStaffId,
            DiagnosticsMove move,
            DiagnosticsActionRequest request,
            VendorDiagnosticsClient.StaffContextView vendorCtx) {
        DiagnosticsOrderStatus from = order.getStatus();
        DiagnosticsOrderStatus to = move == DiagnosticsMove.MARK_COD_RECEIVED
                ? from
                : DiagnosticsOrderWorkflow.next(from, move);
        order.setStatus(to);
        order.setUpdatedBy(actorUserId);
        orderRepository.save(order);
        event(order, actorUserId, actorStaffId, move.name(), from.name(), to.name(),
                request == null ? null : request.getNote());
        if (!from.equals(to)) {
            notifyDiagnosticsBuyer(order, diagnosticsStatusLabel(order, reportAttachmentRows(order)));
        } else if (move == DiagnosticsMove.SET_REPORT_ETA) {
            notifyDiagnosticsBuyer(order, "Report ETA updated");
        }
        return toResponse(order, true, vendorCtx);
    }

    private void guardVendorMove(
            VendorDiagnosticsClient.StaffContextView ctx,
            DiagnosticsOrder order,
            DiagnosticsMove move) {
        if (ctx.vendorOwner() || "LAB_ADMIN".equalsIgnoreCase(ctx.roleType())) {
            return;
        }
        if ("Manager".equalsIgnoreCase(nullToEmpty(ctx.title()))) {
            if (move == DiagnosticsMove.REOPEN) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Only lab admin can reopen reports");
            }
            return;
        }
        if (move == DiagnosticsMove.RECEIVED_AT_LAB
                && ctx.collectionCapable()
                && order.getStatus() == DiagnosticsOrderStatus.SAMPLES_COLLECTED) {
            return;
        }
        if (isLabTechnician(ctx.title())) {
            boolean benchMove = move == DiagnosticsMove.RECEIVED_AT_LAB
                    || move == DiagnosticsMove.SET_REPORT_ETA
                    || move == DiagnosticsMove.UPDATE_RESULTS
                    || move == DiagnosticsMove.FINALIZE
                    || move == DiagnosticsMove.COMPLETE;
            if (benchMove) {
                return;
            }
            throw new BusinessException(ErrorCode.FORBIDDEN, "This action is not allowed for lab technicians");
        }
        if (move == DiagnosticsMove.REOPEN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only lab admin can reopen reports");
        }
        boolean collectionMove = move == DiagnosticsMove.START_COLLECTION
                || move == DiagnosticsMove.REACH_PATIENT
                || move == DiagnosticsMove.CONFIRM_PATIENT
                || move == DiagnosticsMove.SAMPLES_COLLECTED
                || move == DiagnosticsMove.MARK_COD_RECEIVED;
        if (collectionMove) {
            if (!ctx.collectionCapable()) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Collection capability required");
            }
            if (order.getAssignedStaffId() != null && ctx.staffId() != null
                    && !order.getAssignedStaffId().equals(ctx.staffId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "This visit is assigned to another agent");
            }
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "You cannot perform this action");
    }

    private void preventConcurrentVisit(DiagnosticsOrder order, VendorDiagnosticsClient.StaffContextView ctx) {
        UUID staffId = ctx.staffId() != null ? ctx.staffId() : order.getAssignedStaffId();
        if (staffId == null) {
            return;
        }
        EnumSet<DiagnosticsOrderStatus> open = EnumSet.of(
                DiagnosticsOrderStatus.COLLECTION_IN_PROGRESS,
                DiagnosticsOrderStatus.REACHED_PATIENT,
                DiagnosticsOrderStatus.PATIENT_CONFIRMED);
        boolean otherOpen = orderRepository.findByAssignedStaffIdAndStatusIn(staffId, open).stream()
                .anyMatch(other -> !other.getId().equals(order.getId()));
        if (otherOpen) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Finish the visit already in progress before starting another. This keeps samples from mixing.");
        }
    }

    private void guardSamplePhoto(VendorDiagnosticsClient.StaffContextView ctx, DiagnosticsOrder order) {
        DiagnosticsOrderStatus status = order.getStatus();
        if (status != DiagnosticsOrderStatus.PATIENT_CONFIRMED && status != DiagnosticsOrderStatus.SAMPLES_COLLECTED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Photo the sample only after the patient name is confirmed");
        }
        if (ctx.vendorOwner() || "LAB_ADMIN".equalsIgnoreCase(ctx.roleType())) {
            return;
        }
        if (!ctx.collectionCapable()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Collection capability required");
        }
        if (order.getAssignedStaffId() != null && ctx.staffId() != null
                && !order.getAssignedStaffId().equals(ctx.staffId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This visit is assigned to another agent");
        }
    }

    private static boolean isLabTechnician(String title) {
        return title != null && title.toLowerCase().contains("technician");
    }

    private void applyLineResults(UUID orderId, List<DiagnosticsActionRequest.LineResult> rows, UUID actorId) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        Map<UUID, DiagnosticsOrderLine> lines = lineRepository.findByOrderIdOrderByTestNameAsc(orderId).stream()
                .collect(java.util.stream.Collectors.toMap(DiagnosticsOrderLine::getId, l -> l));
        for (DiagnosticsActionRequest.LineResult row : rows) {
            if (row.getLineId() == null) {
                continue;
            }
            DiagnosticsOrderLine line = lines.get(row.getLineId());
            if (line == null) {
                continue;
            }
            line.setResultValue(blank(row.getResultValue()));
            line.setResultUnit(blank(row.getResultUnit()));
            line.setReferenceRange(blank(row.getReferenceRange()));
            line.setResultFlag(blank(row.getResultFlag()));
            line.setUpdatedBy(actorId);
            lineRepository.save(line);
        }
    }

    private VendorDiagnosticsClient.BranchView resolveServingBranch(
            VendorDiagnosticsClient.DiagnosticsLabDetailView lab,
            Map<String, Object> address) {
        Double addrLat = doubleOrNull(address.get("latitude"));
        Double addrLng = doubleOrNull(address.get("longitude"));
        List<VendorDiagnosticsClient.BranchView> active = lab.branches() == null ? List.of() : lab.branches().stream()
                .filter(VendorDiagnosticsClient.BranchView::active)
                .toList();
        if (active.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "This lab has no active collection branches");
        }
        if (addrLat != null && addrLng != null) {
            List<BranchDistance> eligible = new ArrayList<>();
            for (VendorDiagnosticsClient.BranchView branch : active) {
                if (branch.latitude() == null || branch.longitude() == null) {
                    continue;
                }
                double km = GeoDistance.haversineKm(addrLat, addrLng, branch.latitude(), branch.longitude());
                BigDecimal radius = branch.homeCollectionRadiusKm() == null
                        ? new BigDecimal("5")
                        : branch.homeCollectionRadiusKm();
                if (km <= radius.doubleValue()) {
                    eligible.add(new BranchDistance(branch, km));
                }
            }
            if (eligible.isEmpty()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "No branch of this lab collects at this address — try another lab");
            }
            eligible.sort(Comparator.comparingDouble(BranchDistance::km));
            return eligible.get(0).branch();
        }
        return active.get(0);
    }

    private record BranchDistance(VendorDiagnosticsClient.BranchView branch, double km) {
    }

    private void validateSlotBooking(
            VendorDiagnosticsClient.DiagnosticsLabDetailView lab,
            VendorDiagnosticsClient.BranchView branch,
            Instant slotStart,
            UUID slotTemplateId) {
        LocalDate day = slotStart.atZone(IST).toLocalDate();
        Set<String> servingBlockedIds = SlotBlocksByDate.idsForDate(branch.blockedSlotsByDate(), day);
        Set<String> labWideBlockedStarts = labWideBlockedStartTimes(lab, day);
        if (slotTemplateId != null) {
            if (servingBlockedIds.contains(slotTemplateId.toString())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That slot is blocked — pick another time");
            }
            VendorDiagnosticsClient.SlotView byId = findSlotById(branch.slots(), slotTemplateId);
            String startKey = byId == null ? null : normalizeTemplateStartTime(byId.startTime());
            if (startKey != null && labWideBlockedStarts.contains(startKey)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That slot is blocked — pick another time");
            }
        }
        int capacity = 2;
        if (branch.slots() != null) {
            LocalTime pick = slotStart.atZone(IST).toLocalTime();
            for (VendorDiagnosticsClient.SlotView slot : branch.slots()) {
                if (!slot.active()) {
                    continue;
                }
                boolean match = slotTemplateId != null && slot.id().equals(slotTemplateId);
                if (!match && slotTemplateId == null && slot.startTime() != null) {
                    match = slotStartTimeMatches(slot.startTime(), pick);
                }
                if (match) {
                    String startKey = normalizeTemplateStartTime(slot.startTime());
                    if (servingBlockedIds.contains(slot.id().toString())
                            || (startKey != null && labWideBlockedStarts.contains(startKey))) {
                        throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                                "That slot is blocked — pick another time");
                    }
                    capacity = Math.max(1, slot.capacity());
                    break;
                }
            }
        }
        long booked = orderRepository.countByServingBranchIdAndSlotStartAndStatusNot(
                branch.id(), slotStart, DiagnosticsOrderStatus.CANCELLED);
        if (booked >= capacity) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That slot is full — pick another time");
        }
    }

    /**
     * Block UUIDs are per branch template row; the buyer may be served by another branch with different UUIDs for the
     * same clock hour. Union blocked <em>clock times</em> across all active branches for validation.
     */
    private static Set<String> labWideBlockedStartTimes(
            VendorDiagnosticsClient.DiagnosticsLabDetailView lab, LocalDate day) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (lab.branches() == null) {
            return out;
        }
        for (VendorDiagnosticsClient.BranchView b : lab.branches()) {
            if (!b.active()) {
                continue;
            }
            for (String id : SlotBlocksByDate.idsForDate(b.blockedSlotsByDate(), day)) {
                VendorDiagnosticsClient.SlotView row = findSlotByIdString(b.slots(), id);
                if (row == null || !row.active()) {
                    continue;
                }
                String key = normalizeTemplateStartTime(row.startTime());
                if (key != null) {
                    out.add(key);
                }
            }
        }
        return out;
    }

    /**
     * Same clock-hour blocks from any branch, expressed as the <em>serving</em> branch's template UUIDs so the buyer
     * app can filter by {@code blockedSlotsByDate} without new fields.
     */
    private static String mergeBlockedSlotsForBuyer(
            VendorDiagnosticsClient.BranchView serving,
            VendorDiagnosticsClient.DiagnosticsLabDetailView lab) {
        String rawServing = serving.blockedSlotsByDate() == null ? "{}" : serving.blockedSlotsByDate();
        if (lab.branches() == null || lab.branches().size() <= 1) {
            return rawServing;
        }
        Map<LocalDate, LinkedHashSet<String>> merged = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, String> e : SlotBlocksByDate.parse(rawServing).entrySet()) {
            merged.put(e.getKey(), new LinkedHashSet<>(splitBlockedIdCsv(e.getValue())));
        }
        Map<String, VendorDiagnosticsClient.SlotView> servingByStart = indexSlotsByNormalizedStart(serving.slots());
        for (VendorDiagnosticsClient.BranchView b : lab.branches()) {
            if (!b.active() || b.id().equals(serving.id())) {
                continue;
            }
            Map<String, VendorDiagnosticsClient.SlotView> remoteById = indexSlotsByIdString(b.slots());
            for (Map.Entry<LocalDate, String> e : SlotBlocksByDate.parse(
                            b.blockedSlotsByDate() == null ? "{}" : b.blockedSlotsByDate())
                    .entrySet()) {
                LocalDate d = e.getKey();
                for (String id : splitBlockedIdCsv(e.getValue())) {
                    VendorDiagnosticsClient.SlotView remote = remoteById.get(id);
                    if (remote == null || !remote.active()) {
                        continue;
                    }
                    String startKey = normalizeTemplateStartTime(remote.startTime());
                    if (startKey == null) {
                        continue;
                    }
                    VendorDiagnosticsClient.SlotView local = servingByStart.get(startKey);
                    if (local != null && local.active()) {
                        merged.computeIfAbsent(d, k -> new LinkedHashSet<>()).add(local.id().toString());
                    }
                }
            }
        }
        Map<LocalDate, String> serialized = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, LinkedHashSet<String>> e : merged.entrySet()) {
            if (!e.getValue().isEmpty()) {
                serialized.put(e.getKey(), String.join(",", e.getValue()));
            }
        }
        return SlotBlocksByDate.serialize(serialized);
    }

    private static List<String> splitBlockedIdCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String part : csv.split(",")) {
            String id = part.trim();
            if (!id.isEmpty()) {
                out.add(id);
            }
        }
        return out;
    }

    private static Map<String, VendorDiagnosticsClient.SlotView> indexSlotsByIdString(
            List<VendorDiagnosticsClient.SlotView> slots) {
        Map<String, VendorDiagnosticsClient.SlotView> map = new LinkedHashMap<>();
        if (slots == null) {
            return map;
        }
        for (VendorDiagnosticsClient.SlotView s : slots) {
            if (s != null && s.id() != null) {
                map.putIfAbsent(s.id().toString(), s);
            }
        }
        return map;
    }

    private static Map<String, VendorDiagnosticsClient.SlotView> indexSlotsByNormalizedStart(
            List<VendorDiagnosticsClient.SlotView> slots) {
        Map<String, VendorDiagnosticsClient.SlotView> map = new LinkedHashMap<>();
        if (slots == null) {
            return map;
        }
        for (VendorDiagnosticsClient.SlotView s : slots) {
            if (s == null || !s.active()) {
                continue;
            }
            String key = normalizeTemplateStartTime(s.startTime());
            if (key != null) {
                map.putIfAbsent(key, s);
            }
        }
        return map;
    }

    private static VendorDiagnosticsClient.SlotView findSlotById(
            List<VendorDiagnosticsClient.SlotView> slots, UUID id) {
        if (slots == null || id == null) {
            return null;
        }
        for (VendorDiagnosticsClient.SlotView s : slots) {
            if (s != null && id.equals(s.id())) {
                return s;
            }
        }
        return null;
    }

    private static VendorDiagnosticsClient.SlotView findSlotByIdString(
            List<VendorDiagnosticsClient.SlotView> slots, String id) {
        if (slots == null || id == null || id.isBlank()) {
            return null;
        }
        try {
            return findSlotById(slots, UUID.fromString(id.trim()));
        } catch (Exception ignored) {
            return null;
        }
    }

    /** Canonical HH:mm for template starts (stable across branches and DB formatting). */
    private static String normalizeTemplateStartTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String t = raw.trim();
        if (t.contains("T")) {
            t = t.substring(t.indexOf('T') + 1);
        }
        try {
            LocalTime lt = LocalTime.parse(t);
            lt = lt.withSecond(0).withNano(0);
            return String.format("%02d:%02d", lt.getHour(), lt.getMinute());
        } catch (Exception ignored) {
            return null;
        }
    }

    private static boolean slotStartTimeMatches(String templateStart, LocalTime pick) {
        if (templateStart == null || templateStart.isBlank()) {
            return false;
        }
        String raw = templateStart.trim();
        if (raw.contains("T")) {
            raw = raw.substring(raw.indexOf('T') + 1);
        }
        if (raw.length() >= 5) {
            raw = raw.substring(0, 5);
        }
        try {
            return LocalTime.parse(raw).equals(pick.withSecond(0).withNano(0));
        } catch (Exception ignored) {
            return false;
        }
    }

    private record CartLine(UUID testId, String testName, BigDecimal unitPrice, UUID packageId, String packageName) {
    }

    private record CartResolution(BigDecimal subtotal, List<CartLine> lines) {
    }

    private CartResolution resolveCart(
            VendorDiagnosticsClient.DiagnosticsLabDetailView lab,
            List<UUID> testIds,
            List<UUID> packageIds) {
        boolean hasTests = testIds != null && !testIds.isEmpty();
        boolean hasPackages = packageIds != null && !packageIds.isEmpty();
        if (!hasTests && !hasPackages) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose at least one test or package");
        }
        List<VendorDiagnosticsClient.TestView> catalog = lab.tests() == null ? List.of() : lab.tests();
        List<VendorDiagnosticsClient.PackageView> packages = lab.packages() == null ? List.of() : lab.packages();
        List<CartLine> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (hasTests) {
            for (UUID testId : testIds) {
                VendorDiagnosticsClient.TestView test = catalog.stream()
                        .filter(t -> t.id().equals(testId) && t.active())
                        .findFirst()
                        .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Test not offered: " + testId));
                BigDecimal price = money(test.price());
                subtotal = subtotal.add(price);
                lines.add(new CartLine(test.id(), test.name(), price, null, null));
            }
        }
        if (hasPackages) {
            for (UUID packageId : packageIds) {
                VendorDiagnosticsClient.PackageView pkg = packages.stream()
                        .filter(p -> p.id().equals(packageId) && p.active())
                        .findFirst()
                        .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Package not offered: " + packageId));
                if (pkg.testIds() == null || pkg.testIds().isEmpty()) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Package has no tests: " + packageId);
                }
                BigDecimal pkgPrice = money(pkg.price());
                subtotal = subtotal.add(pkgPrice);
                boolean first = true;
                for (UUID memberId : pkg.testIds()) {
                    VendorDiagnosticsClient.TestView test = catalog.stream()
                            .filter(t -> t.id().equals(memberId) && t.active())
                            .findFirst()
                            .orElseThrow(() -> new BusinessException(
                                    ErrorCode.VALIDATION_ERROR, "Package includes unavailable test: " + memberId));
                    BigDecimal linePrice = first ? pkgPrice : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
                    first = false;
                    lines.add(new CartLine(test.id(), test.name(), linePrice, pkg.id(), pkg.name()));
                }
            }
        }
        return new CartResolution(subtotal.setScale(2, RoundingMode.HALF_UP), lines);
    }

    private static String reportDownloadPath(DiagnosticsOrder order) {
        if (order.getStatus() != DiagnosticsOrderStatus.REPORT_FINALIZED
                && order.getStatus() != DiagnosticsOrderStatus.COMPLETED) {
            return null;
        }
        return "/api/v1/orders/diagnostics/" + order.getId() + "/report.pdf";
    }

    private static List<String> buyerAllowedActions(DiagnosticsOrder order) {
        List<String> out = new ArrayList<>();
        DiagnosticsOrderStatus status = order.getStatus();
        boolean prepaidPaid = order.getPaymentMethod() == DiagnosticsPaymentMethod.UPI
                && order.getPaymentStatus() == DiagnosticsPaymentStatus.PAID;
        if (prepaidPaid) {
            return out;
        }
        if (status == DiagnosticsOrderStatus.BOOKED && order.getAssignedStaffId() == null) {
            out.add("CANCEL");
        }
        if (status == DiagnosticsOrderStatus.AWAITING_PAYMENT) {
            out.add("CANCEL");
        }
        return out;
    }

    private static List<String> vendorAllowedActions(
            DiagnosticsOrder order, VendorDiagnosticsClient.StaffContextView ctx) {
        List<String> out = new ArrayList<>();
        DiagnosticsOrderStatus status = order.getStatus();
        boolean owner = ctx.vendorOwner() || "LAB_ADMIN".equalsIgnoreCase(nullToEmpty(ctx.roleType()));
        boolean manager = owner || "Manager".equalsIgnoreCase(nullToEmpty(ctx.title()));
        boolean bench = owner || manager || isLabTechnician(ctx.title());
        boolean collector = ctx.collectionCapable();
        boolean assignedToMe = order.getAssignedStaffId() != null
                && ctx.staffId() != null
                && order.getAssignedStaffId().equals(ctx.staffId());

        if (manager && (status == DiagnosticsOrderStatus.BOOKED
                || status == DiagnosticsOrderStatus.ASSIGNED
                || status.isOpenFieldVisit())) {
            boolean onlinePaidOrNotPrepaid = order.getPaymentMethod() != DiagnosticsPaymentMethod.UPI
                    || order.getPaymentStatus() == DiagnosticsPaymentStatus.PAID;
            if (onlinePaidOrNotPrepaid) {
                out.add("ASSIGN");
            }
        }
        if (collector && assignedToMe) {
            if (status == DiagnosticsOrderStatus.ASSIGNED) {
                out.add("START_COLLECTION");
            }
            if (status == DiagnosticsOrderStatus.COLLECTION_IN_PROGRESS) {
                out.add("REACH_PATIENT");
            }
            if (status == DiagnosticsOrderStatus.REACHED_PATIENT) {
                out.add("CONFIRM_PATIENT");
            }
            if (status == DiagnosticsOrderStatus.PATIENT_CONFIRMED) {
                out.add("SAMPLES_COLLECTED");
                out.add("ADD_SAMPLE_PHOTO");
                out.add("REMOVE_SAMPLE_PHOTO");
            }
            if (status == DiagnosticsOrderStatus.SAMPLES_COLLECTED) {
                out.add("RECEIVED_AT_LAB");
                out.add("ADD_SAMPLE_PHOTO");
                out.add("REMOVE_SAMPLE_PHOTO");
            }
            if (status == DiagnosticsOrderStatus.ASSIGNED || status.isOpenFieldVisit()) {
                if (order.getPaymentMethod() == DiagnosticsPaymentMethod.COD
                        && order.getPaymentStatus() != DiagnosticsPaymentStatus.COLLECTED
                        && order.getPaymentStatus() != DiagnosticsPaymentStatus.PAID) {
                    out.add("MARK_COD_RECEIVED");
                }
            }
        }
        if (bench) {
            if (status == DiagnosticsOrderStatus.SAMPLES_COLLECTED) {
                out.add("RECEIVED_AT_LAB");
            }
            if (isBenchOpenStatus(status)) {
                if (order.getSamplesBenchConfirmedAt() != null) {
                    out.add("ADD_REPORT_ATTACHMENT");
                }
                out.add("REMOVE_REPORT_ATTACHMENT");
                if (order.getSamplesBenchConfirmedAt() == null) {
                    out.add("CONFIRM_SAMPLES_RECEIVED");
                }
            }
            if (status == DiagnosticsOrderStatus.RECEIVED_AT_LAB) {
                out.add("SET_REPORT_ETA");
                out.add("UPDATE_RESULTS");
            }
            if (status == DiagnosticsOrderStatus.REPORT_ETA_SET || status == DiagnosticsOrderStatus.REPORT_IN_PROGRESS) {
                out.add("SET_REPORT_ETA");
                out.add("UPDATE_RESULTS");
                if (order.getSamplesBenchConfirmedAt() != null && hasReportAttachments(order)) {
                    out.add("FINALIZE");
                }
            }
        }
        return out;
    }

    private static boolean isBenchOpenStatus(DiagnosticsOrderStatus status) {
        return status == DiagnosticsOrderStatus.RECEIVED_AT_LAB
                || status == DiagnosticsOrderStatus.REPORT_ETA_SET
                || status == DiagnosticsOrderStatus.REPORT_IN_PROGRESS;
    }

    private DiagnosticsOrderResponse toResponse(
            DiagnosticsOrder order,
            boolean includeEvents,
            VendorDiagnosticsClient.StaffContextView vendorCtx) {
        List<DiagnosticsOrderLine> lines = lineRepository.findByOrderIdOrderByTestNameAsc(order.getId());
        DiagnosticsOrderResponse.DiagnosticsOrderResponseBuilder builder = DiagnosticsOrderResponse.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .townId(order.getTownId())
                .vendorId(order.getVendorId())
                .shopName(order.getShopName())
                .buyerId(order.getBuyerId())
                .patientProfileId(order.getPatientProfileId())
                .patientName(order.getPatientName())
                .referenceType(order.getReferenceType())
                .referringDoctorName(order.getReferringDoctorName())
                .servingBranchId(order.getServingBranchId())
                .servingBranchLabel(order.getServingBranchLabel())
                .status(order.getStatus().name())
                .statusLabel(order.getStatus().label())
                .paymentMethod(order.getPaymentMethod().name())
                .paymentStatus(order.getPaymentStatus().name())
                .testsSubtotal(money(order.getTestsSubtotal()))
                .homeCollectionFee(money(order.getHomeCollectionFee()))
                .platformFeeAmount(money(order.getPlatformFeeAmount()))
                .codFee(money(order.getCodFee()))
                .totalAmount(orderTotal(order))
                .amountCollected(money(order.getAmountCollected()))
                .addressId(order.getAddressId())
                .addressText(order.getAddressText())
                .contactName(order.getContactName())
                .contactPhone(order.getContactPhone())
                .slotStart(order.getSlotStart())
                .slotEnd(order.getSlotEnd())
                .assignedStaffId(order.getAssignedStaffId())
                .assignedStaffName(order.getAssignedStaffName())
                .receivedByStaffId(order.getReceivedByStaffId())
                .receivedByStaffName(order.getReceivedByStaffName())
                .reportEta(order.getReportEta())
                .reportFinalizedAt(order.getReportFinalizedAt())
                .samplesBenchConfirmedAt(order.getSamplesBenchConfirmedAt())
                .placedAt(order.getPlacedAt())
                .reportDownloadUrl(reportDownloadPath(order))
                .allowedActions(vendorCtx == null ? buyerAllowedActions(order) : vendorAllowedActions(order, vendorCtx))
                .lines(lines.stream().map(line -> DiagnosticsOrderResponse.LineResponse.builder()
                        .id(line.getId())
                        .testId(line.getTestId())
                        .testName(line.getTestName())
                        .unitPrice(money(line.getUnitPrice()))
                        .resultValue(line.getResultValue())
                        .resultUnit(line.getResultUnit())
                        .referenceRange(line.getReferenceRange())
                        .resultFlag(line.getResultFlag())
                        .build()).toList());
        List<DiagnosticsOrderEvent> events = includeEvents
                ? eventRepository.findByOrderIdOrderByCreatedAtAsc(order.getId())
                : List.of();
        if (includeEvents) {
            builder.events(events.stream()
                    .map(ev -> DiagnosticsOrderResponse.EventResponse.builder()
                            .eventType(ev.getEventType())
                            .fromStatus(ev.getFromStatus())
                            .toStatus(ev.getToStatus())
                            .note(ev.getNote())
                            .createdAt(ev.getCreatedAt())
                            .build())
                    .toList());
        }
        builder.samplePhotos(samplePhotoResponses(order, events));
        List<ReportAttachmentRow> attachments = reportAttachmentRows(order);
        builder.reportAttachments(attachments.stream()
                .map(row -> DiagnosticsOrderResponse.ReportAttachmentResponse.builder()
                        .mediaId(row.mediaId())
                        .url(reportAttachmentPublicUrl(order, row, vendorCtx))
                        .kind(row.kind())
                        .contentType(row.contentType())
                        .build())
                .toList());
        builder.reportAttachmentUrls(attachments.stream()
                .map(row -> reportAttachmentPublicUrl(order, row, vendorCtx))
                .toList());
        builder.statusLabel(diagnosticsStatusLabel(order, attachments));
        return builder.build();
    }

    private void notifyDiagnosticsBuyer(DiagnosticsOrder order, String statusLabel) {
        notificationClient.notifyOrderStatusUpdated(
                order.getTownId(),
                order.getId(),
                order.getBuyerId(),
                order.getContactPhone(),
                order.getOrderNumber(),
                statusLabel,
                "Diagnostics");
    }

    /** Shown on vendor/buyer cards when interim report files exist before finalize. */
    private static String diagnosticsStatusLabel(DiagnosticsOrder order, List<ReportAttachmentRow> attachments) {
        DiagnosticsOrderStatus status = order.getStatus();
        if (status == DiagnosticsOrderStatus.REPORT_FINALIZED
                || status == DiagnosticsOrderStatus.COMPLETED
                || status == DiagnosticsOrderStatus.CANCELLED) {
            return status.label();
        }
        boolean hasInterim = attachments.stream().anyMatch(r -> "INTERIM".equals(r.kind()));
        if (hasInterim
                && (status == DiagnosticsOrderStatus.RECEIVED_AT_LAB
                        || status == DiagnosticsOrderStatus.REPORT_ETA_SET
                        || status == DiagnosticsOrderStatus.REPORT_IN_PROGRESS)) {
            return "Interim report uploaded";
        }
        return status.label();
    }

    private DiagnosticsOrderResponse addReportAttachment(
            VendorDiagnosticsClient.StaffContextView ctx,
            DiagnosticsOrder order,
            UUID userId,
            DiagnosticsActionRequest request) {
        guardLabBench(ctx, order);
        if (!isBenchOpenStatus(order.getStatus())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Upload reports only while work is in progress");
        }
        if (order.getSamplesBenchConfirmedAt() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Confirm samples received for the patient before uploading reports");
        }
        if (request.getMediaId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "mediaId is required");
        }
        String kind = normalizeReportKind(request.getReportKind());
        MediaClient.MediaMeta meta = mediaClient.meta(request.getMediaId());
        if (meta.context() == null || !"DIAGNOSTICS_REPORT".equalsIgnoreCase(meta.context().trim())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Upload file as a diagnostics report");
        }
        List<ReportAttachmentRow> rows = reportAttachmentRows(order);
        if (rows.size() >= MAX_REPORT_ATTACHMENTS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Maximum 5 report attachments per booking");
        }
        if (rows.stream().anyMatch(r -> r.mediaId().equals(request.getMediaId()))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That file is already attached");
        }
        rows.add(new ReportAttachmentRow(request.getMediaId(), kind, meta.contentType()));
        order.setReportAttachmentMeta(encodeReportAttachments(rows));
        order.setUpdatedBy(userId);
        orderRepository.save(order);
        event(order, userId, ctx.staffId(), "ADD_REPORT_ATTACHMENT", order.getStatus().name(), order.getStatus().name(),
                request.getMediaId() + "|" + kind);
        notifyDiagnosticsBuyer(order, diagnosticsStatusLabel(order, rows));
        return toResponse(order, true, ctx);
    }

    private DiagnosticsOrderResponse removeReportAttachment(
            VendorDiagnosticsClient.StaffContextView ctx,
            DiagnosticsOrder order,
            UUID userId,
            DiagnosticsActionRequest request) {
        guardLabBench(ctx, order);
        if (order.getStatus() == DiagnosticsOrderStatus.REPORT_FINALIZED
                || order.getStatus() == DiagnosticsOrderStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Reopen the report to change attachments");
        }
        if (request.getMediaId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "mediaId is required");
        }
        List<ReportAttachmentRow> rows = reportAttachmentRows(order);
        boolean removed = rows.removeIf(r -> r.mediaId().equals(request.getMediaId()));
        if (!removed) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That attachment is not on this booking");
        }
        order.setReportAttachmentMeta(encodeReportAttachments(rows));
        order.setUpdatedBy(userId);
        orderRepository.save(order);
        mediaClient.deleteOne(request.getMediaId());
        event(order, userId, ctx.staffId(), "REMOVE_REPORT_ATTACHMENT", order.getStatus().name(),
                order.getStatus().name(), request.getMediaId().toString());
        notifyDiagnosticsBuyer(order, diagnosticsStatusLabel(order, rows));
        return toResponse(order, true, ctx);
    }

    private void guardLabBench(VendorDiagnosticsClient.StaffContextView ctx, DiagnosticsOrder order) {
        if (ctx.vendorOwner() || "LAB_ADMIN".equalsIgnoreCase(ctx.roleType())) {
            return;
        }
        if ("Manager".equalsIgnoreCase(nullToEmpty(ctx.title()))) {
            return;
        }
        if (isLabTechnician(ctx.title())) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Lab bench access required");
    }

    private static String normalizeReportKind(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "reportKind must be INTERIM or FINAL");
        }
        String upper = raw.trim().toUpperCase();
        if (!"INTERIM".equals(upper) && !"FINAL".equals(upper)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "reportKind must be INTERIM or FINAL");
        }
        return upper;
    }

    private static String reportAttachmentPublicUrl(
            DiagnosticsOrder order, ReportAttachmentRow row, VendorDiagnosticsClient.StaffContextView vendorCtx) {
        if (vendorCtx != null) {
            return "/api/v1/media/" + row.mediaId() + "/content";
        }
        return "/api/v1/orders/diagnostics/" + order.getId() + "/report-files/" + row.mediaId();
    }

    private record ReportAttachmentRow(UUID mediaId, String kind, String contentType) {
    }

    private static boolean hasReportAttachments(DiagnosticsOrder order) {
        String raw = order.getReportAttachmentMeta();
        if (raw == null || raw.isBlank()) {
            return false;
        }
        for (String part : raw.split(",")) {
            if (part.isBlank()) {
                continue;
            }
            String[] bits = part.split("\\|", 3);
            if (parseUuid(bits[0]) != null) {
                return true;
            }
        }
        return false;
    }

    private List<ReportAttachmentRow> reportAttachmentRows(DiagnosticsOrder order) {
        String raw = order.getReportAttachmentMeta();
        if (raw == null || raw.isBlank()) {
            return new ArrayList<>();
        }
        List<ReportAttachmentRow> out = new ArrayList<>();
        for (String part : raw.split(",")) {
            if (part.isBlank()) {
                continue;
            }
            String[] bits = part.split("\\|", 3);
            UUID id = parseUuid(bits[0]);
            if (id == null) {
                continue;
            }
            String kind = bits.length > 1 && bits[1] != null && !bits[1].isBlank() ? bits[1].trim().toUpperCase() : "FINAL";
            String contentType = bits.length > 2 ? bits[2] : null;
            if (!"INTERIM".equals(kind) && !"FINAL".equals(kind)) {
                kind = "FINAL";
            }
            out.add(new ReportAttachmentRow(id, kind, contentType));
        }
        if (out.size() > MAX_REPORT_ATTACHMENTS) {
            return new ArrayList<>(out.subList(0, MAX_REPORT_ATTACHMENTS));
        }
        return out;
    }

    private static String encodeReportAttachments(List<ReportAttachmentRow> rows) {
        if (rows == null || rows.isEmpty()) {
            return "";
        }
        StringJoiner joiner = new StringJoiner(",");
        for (ReportAttachmentRow row : rows) {
            if (row.mediaId() == null) {
                continue;
            }
            String ct = row.contentType() == null ? "" : row.contentType().replace("|", "").replace(",", "");
            joiner.add(row.mediaId() + "|" + row.kind() + "|" + ct);
        }
        return joiner.toString();
    }

    private List<UUID> samplePhotoIds(DiagnosticsOrder order) {
        return listedPhotoIds(order, eventRepository.findByOrderIdOrderByCreatedAtAsc(order.getId()));
    }

    private List<DiagnosticsOrderResponse.SamplePhotoResponse> samplePhotoResponses(
            DiagnosticsOrder order, List<DiagnosticsOrderEvent> events) {
        return listedPhotoIds(order, events).stream()
                .limit(MAX_SAMPLE_PHOTOS)
                .map(id -> DiagnosticsOrderResponse.SamplePhotoResponse.builder()
                        .mediaId(id)
                        .url("/api/v1/media/" + id + "/content")
                        .build())
                .toList();
    }

    /** Once the column is written (including empty), it is the source of truth so deletes stick. */
    private static List<UUID> listedPhotoIds(DiagnosticsOrder order, List<DiagnosticsOrderEvent> events) {
        if (order.getSamplePhotoMediaIds() != null) {
            return parseMediaIds(order.getSamplePhotoMediaIds());
        }
        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        for (DiagnosticsOrderEvent ev : events) {
            if (!"SAMPLE_PHOTO".equalsIgnoreCase(ev.getEventType())) {
                continue;
            }
            UUID parsed = parseUuid(ev.getNote());
            if (parsed != null) {
                ids.add(parsed);
            }
        }
        List<UUID> all = new ArrayList<>(ids);
        return all.size() <= MAX_SAMPLE_PHOTOS ? all : new ArrayList<>(all.subList(0, MAX_SAMPLE_PHOTOS));
    }

    private static List<UUID> parseMediaIds(String raw) {
        List<UUID> out = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        for (String part : raw.split(",")) {
            UUID parsed = parseUuid(part);
            if (parsed != null && !out.contains(parsed)) {
                out.add(parsed);
            }
        }
        return out;
    }

    private static String joinMediaIds(List<UUID> ids) {
        StringJoiner joiner = new StringJoiner(",");
        for (UUID id : ids) {
            if (id != null) {
                joiner.add(id.toString());
            }
        }
        return joiner.toString();
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private void event(
            DiagnosticsOrder order,
            UUID actorUserId,
            UUID actorStaffId,
            String eventType,
            String from,
            String to,
            String note) {
        eventRepository.save(DiagnosticsOrderEvent.builder()
                .orderId(order.getId())
                .actorUserId(actorUserId)
                .actorStaffId(actorStaffId)
                .eventType(eventType)
                .fromStatus(from)
                .toStatus(to)
                .note(note)
                .build());
    }

    private DiagnosticsOrder requireOrder(UUID orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
    }

    private void requireTownDiagnostics(UUID townId) {
        if (!townClient.isDiagnosticsEnabled(townId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Diagnostics is not enabled in this town");
        }
    }

    private String nextNumber(LocalDate day) {
        DiagnosticsDaySeq seq = daySeqRepository.lockDay(day).orElseGet(() -> {
            DiagnosticsDaySeq created = new DiagnosticsDaySeq();
            created.setDay(day);
            created.setNextVal(1);
            return daySeqRepository.save(created);
        });
        int no = seq.getNextVal();
        seq.setNextVal(no + 1);
        daySeqRepository.save(seq);
        return "DX" + DAY.format(day) + "-" + String.format("%04d", no);
    }

    private static BigDecimal orderTotal(DiagnosticsOrder order) {
        return money(order.getTestsSubtotal())
                .add(money(order.getHomeCollectionFee()))
                .add(money(order.getPlatformFeeAmount()))
                .add(money(order.getCodFee()));
    }

    private static DiagnosticsPaymentMethod parsePayment(String raw) {
        if (raw == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "paymentMethod is required");
        }
        return switch (raw.trim().toUpperCase()) {
            case "UPI", "ONLINE" -> DiagnosticsPaymentMethod.UPI;
            case "COD", "CASH" -> DiagnosticsPaymentMethod.COD;
            default -> throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Use UPI or COD");
        };
    }

    private static DiagnosticsMove parseMove(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "action is required");
        }
        try {
            return DiagnosticsMove.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown action: " + raw);
        }
    }

    private static String normalizeReference(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "referenceType is required");
        }
        String upper = raw.trim().toUpperCase();
        if (!"SELF".equals(upper) && !"DOCTOR".equals(upper)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "referenceType must be SELF or DOCTOR");
        }
        return upper;
    }

    private static String formatAddress(Map<String, Object> address) {
        StringJoiner joiner = new StringJoiner(" ");
        String line1 = addressTextPart(address.get("line1"));
        String line2 = addressTextPart(address.get("line2"));
        String landmark = addressTextPart(address.get("landmark"));
        String pincode = addressTextPart(address.get("pincode"));
        if (!line1.isEmpty()) {
            joiner.add(line1);
        }
        if (!line2.isEmpty()) {
            joiner.add(line2);
        }
        if (!landmark.isEmpty()) {
            joiner.add("Near " + landmark);
        }
        if (!pincode.isEmpty()) {
            joiner.add(pincode);
        }
        return joiner.toString();
    }

    /** Avoid literal "null" when JSON omits a field or sends null — matches buyer address display behavior. */
    private static String addressTextPart(Object raw) {
        if (raw == null) {
            return "";
        }
        if (raw instanceof String s) {
            String t = s.trim();
            if (t.isEmpty() || "null".equalsIgnoreCase(t)) {
                return "";
            }
            return t;
        }
        String s = String.valueOf(raw).trim();
        return "null".equalsIgnoreCase(s) ? "" : s;
    }

    private static Double doubleOrNull(Object raw) {
        if (raw instanceof Number n) {
            return n.doubleValue();
        }
        if (raw instanceof String s && !s.isBlank()) {
            return Double.parseDouble(s.trim());
        }
        return null;
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
