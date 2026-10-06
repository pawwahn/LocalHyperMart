package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.OrderClient.CodDeliveredItem;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import com.hyperlocalmart.payment.dto.request.CreateHubCodPaymentRequest;
import com.hyperlocalmart.payment.dto.request.CreateHubFranchisePaymentRequest;
import com.hyperlocalmart.payment.dto.request.PreviewHubCodForMeRequest;
import com.hyperlocalmart.payment.dto.request.SubmitHubPaymentForRequest;
import com.hyperlocalmart.payment.dto.response.CodHubLedgerResponse;
import com.hyperlocalmart.payment.dto.response.DeliverySettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.HubCodPaymentPreviewResponse;
import com.hyperlocalmart.payment.dto.response.HubFranchiseDuePreviewResponse;
import com.hyperlocalmart.payment.dto.response.HubPaymentRequestResponse;
import com.hyperlocalmart.payment.dto.response.HubPlatformPaymentSubmissionResponse;
import com.hyperlocalmart.payment.entity.*;
import com.hyperlocalmart.payment.repository.HubPaymentRequestCodLineRepository;
import com.hyperlocalmart.payment.repository.HubPaymentRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
@Service
@RequiredArgsConstructor
public class HubPaymentRequestService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final List<HubPaymentRequestStatus> BLOCKING_STATUSES = List.of(
            HubPaymentRequestStatus.ISSUED,
            HubPaymentRequestStatus.PAYMENT_PENDING,
            HubPaymentRequestStatus.APPROVED);

    private final DeliveryClient deliveryClient;
    private final OrderClient orderClient;
    private final CodHubLedgerService codHubLedgerService;
    private final CodCloseDayLineItemRepository codCloseDayLineItemRepository;
    private final DeliverySettlementService deliverySettlementService;
    private final HubPaymentRequestRepository requestRepository;
    private final HubPaymentRequestCodLineRepository codLineRepository;
    private final HubPlatformPaymentSubmissionService submissionService;
    private final HubBillNumberService billNumberService;

    @Transactional(readOnly = true)
    public List<HubPaymentRequestResponse> listForHub(UUID hubAdminUserId, HubPaymentRequestType type) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        billNumberService.ensureAssigned(hub.townId());
        return requestRepository.findForHub(hub.hubId(), type).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public HubPaymentRequestResponse getForHub(UUID hubAdminUserId, UUID requestId) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        HubPaymentRequest row = requestRepository.findDetailedByIdAndHubId(requestId, hub.hubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment request not found"));
        return toResponse(row);
    }

    @Transactional(readOnly = true)
    public List<HubPaymentRequestResponse> listForAdmin(UUID townId, UUID hubId, String typeRaw, UUID actorUserId) {
        HubPaymentRequestType type = parseType(typeRaw);
        billNumberService.ensureAssigned(townId);
        List<HubPaymentRequest> rows = requestRepository.findForAdmin(townId, hubId, type);
        return toSummaries(rows);
    }

    @Transactional(readOnly = true)
    public PageResponse<HubPaymentRequestResponse.CodLine> listLines(UUID requestId, int page, int size) {
        if (!requestRepository.existsById(requestId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Payment request not found");
        }
        int safeSize = clampSize(size, 50, 10_000);
        int safePage = Math.max(page, 0);
        Page<HubPaymentRequestCodLine> result = codLineRepository.findByRequest_IdOrderByCloseDateAscIdAsc(
                requestId, PageRequest.of(safePage, safeSize, Sort.by("closeDate").ascending().and(Sort.by("id"))));
        return PageResponse.<HubPaymentRequestResponse.CodLine>builder()
                .items(result.getContent().stream().map(this::toCodLineResponse).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public HubCodPaymentPreviewResponse previewCod(
            CreateHubCodPaymentRequest request, UUID actorUserId, Integer page, Integer size) {
        LocalDate[] window = resolvePeriod(parsePeriodKind(request.getPeriodKind()), request.getPeriodStart(), request.getPeriodEnd());
        CodDraft draft = buildCodDraft(request.getTownId(), request.getHubId(), window[0], window[1]);
        List<HubPaymentRequestResponse.CodLine> all = draft.lines().stream().map(this::toCodLineResponse).toList();
        int total = all.size();
        boolean paged = page != null || size != null;
        int safeSize = paged ? clampSize(size == null ? 50 : size, 50, 10_000) : Math.max(total, 1);
        int safePage = paged ? Math.max(page == null ? 0 : page, 0) : 0;
        int from = paged ? Math.min(safePage * safeSize, total) : 0;
        int to = paged ? Math.min(from + safeSize, total) : total;
        return HubCodPaymentPreviewResponse.builder()
                .townId(request.getTownId())
                .hubId(request.getHubId())
                .periodKind(parsePeriodKind(request.getPeriodKind()).name())
                .periodStart(window[0].toString())
                .periodEnd(window[1].toString())
                .totalAmount(draft.total())
                .hubBalanceOwedToCompany(draft.balanceOwed())
                .orderCount(total)
                .page(paged ? safePage : 0)
                .size(paged ? safeSize : total)
                .codLines(all.subList(from, to))
                .warning(draft.warning())
                .build();
    }

    @Transactional(readOnly = true)
    public HubCodPaymentPreviewResponse previewCodForHub(UUID hubAdminUserId, PreviewHubCodForMeRequest request) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        CreateHubCodPaymentRequest body = new CreateHubCodPaymentRequest();
        body.setTownId(hub.townId());
        body.setHubId(hub.hubId());
        body.setPeriodKind(request.getPeriodKind());
        body.setPeriodStart(request.getPeriodStart());
        body.setPeriodEnd(request.getPeriodEnd());
        HubCodPaymentPreviewResponse preview = previewCod(body, hubAdminUserId, null, null);
        if (preview.getWarning() != null && preview.getWarning().contains("issue a smaller")) {
            preview.setWarning("Period total exceeds current hub COD balance (₹"
                    + preview.getHubBalanceOwedToCompany()
                    + ") — pick a smaller date range.");
        }
        return preview;
    }

    @Transactional(readOnly = true)
    public HubFranchiseDuePreviewResponse previewFranchiseForHub(UUID hubAdminUserId, int billingYear, int billingMonth) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        YearMonth ym = YearMonth.of(billingYear, billingMonth);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        DeliverySettlementCandidateView.FranchiseDue due = deliverySettlementService.listCandidates(
                hub.townId(), SettlementPayeeType.HUB, hub.hubId(), start, end).getFranchise();
        boolean enabled = due != null && due.isEnabled();
        return HubFranchiseDuePreviewResponse.builder()
                .billingYear(billingYear)
                .billingMonth(billingMonth)
                .periodStart(start.toString())
                .periodEnd(end.toString())
                .enabled(enabled)
                .alreadyCollected(enabled && due.isAlreadyCollected())
                .amount(enabled ? scale(due.getAmount()) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .label(due != null ? due.getLabel() : null)
                .build();
    }

    @Transactional
    public HubPaymentRequestResponse createCod(CreateHubCodPaymentRequest request, UUID actorUserId) {
        HubPaymentRequestPeriodKind kind = parsePeriodKind(request.getPeriodKind());
        LocalDate[] window = resolvePeriod(kind, request.getPeriodStart(), request.getPeriodEnd());
        CodDraft draft = buildCodDraft(request.getTownId(), request.getHubId(), window[0], window[1]);
        if (draft.lines().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "No remittable COD orders in this period — check hub close-days or pick another range");
        }
        if (draft.total().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "COD total must be more than ₹0");
        }
        BigDecimal lineSum = draft.lines().stream()
                .map(CodLineDraft::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        if (lineSum.compareTo(draft.total()) != 0) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "COD line total " + lineSum + " does not match statement total " + draft.total()
                            + " — refresh preview and try again");
        }
        if (draft.total().compareTo(draft.balanceOwed()) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Statement total ₹" + draft.total() + " exceeds hub COD balance owed ₹" + draft.balanceOwed()
                            + ". Issue a smaller date range so amounts match the ledger to the paisa.");
        }

        HubPaymentRequest row = HubPaymentRequest.builder()
                .townId(request.getTownId())
                .hubId(request.getHubId())
                .requestType(HubPaymentRequestType.COD)
                .periodKind(kind)
                .periodStart(window[0])
                .periodEnd(window[1])
                .totalAmount(draft.total())
                .status(HubPaymentRequestStatus.ISSUED)
                .build();
        row.setCreatedBy(actorUserId);
        row.setUpdatedBy(actorUserId);

        for (CodLineDraft line : draft.lines()) {
            HubPaymentRequestCodLine entity = HubPaymentRequestCodLine.builder()
                    .request(row)
                    .orderId(line.orderId())
                    .orderNumber(line.orderNumber())
                    .closeDate(line.closeDate())
                    .amount(line.amount())
                    .build();
            entity.setCreatedBy(actorUserId);
            entity.setUpdatedBy(actorUserId);
            row.getCodLines().add(entity);
        }
        billNumberService.assign(row);
        HubPaymentRequest saved = requestRepository.save(row);
        return toSummary(saved, draft.lines().size());
    }

    @Transactional
    public HubPaymentRequestResponse createFranchise(CreateHubFranchisePaymentRequest request, UUID actorUserId) {
        YearMonth ym = YearMonth.of(request.getBillingYear(), request.getBillingMonth());
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        if (requestRepository.existsFranchiseForPeriod(
                request.getHubId(), start, end, BLOCKING_STATUSES)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "A franchise payment request already exists for " + ym + " (issued, pending, or approved)");
        }

        DeliverySettlementCandidateView.FranchiseDue due = deliverySettlementService.listCandidates(
                request.getTownId(), SettlementPayeeType.HUB, request.getHubId(), start, end).getFranchise();
        if (due == null || !due.isEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Franchise is not enabled for this town");
        }
        if (due.isAlreadyCollected()) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Franchise for " + ym + " is already collected — no new bill needed");
        }
        BigDecimal amount = scale(due.getAmount());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Franchise amount must be more than ₹0");
        }

        HubPaymentRequest row = HubPaymentRequest.builder()
                .townId(request.getTownId())
                .hubId(request.getHubId())
                .requestType(HubPaymentRequestType.FRANCHISE)
                .periodKind(HubPaymentRequestPeriodKind.MONTHLY)
                .periodStart(start)
                .periodEnd(end)
                .totalAmount(amount)
                .franchiseLabel(due.getLabel())
                .status(HubPaymentRequestStatus.ISSUED)
                .build();
        row.setCreatedBy(actorUserId);
        row.setUpdatedBy(actorUserId);
        billNumberService.assign(row);
        return toSummary(requestRepository.save(row), 0);
    }

    @Transactional
    public HubPaymentRequestResponse cancel(UUID requestId, UUID actorUserId) {
        HubPaymentRequest row = requestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment request not found"));
        if (row.getStatus() != HubPaymentRequestStatus.ISSUED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Only open bills (not yet paid by hub) can be cancelled");
        }
        row.setStatus(HubPaymentRequestStatus.CANCELLED);
        row.setUpdatedBy(actorUserId);
        HubPaymentRequest saved = requestRepository.save(row);
        return toSummary(saved, (int) codLineRepository.countByRequest_Id(saved.getId()));
    }

    @Transactional
    public HubPlatformPaymentSubmissionResponse submitForRequest(
            UUID hubAdminUserId, UUID requestId, SubmitHubPaymentForRequest body) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        HubPaymentRequest row = requestRepository.findDetailedByIdAndHubId(requestId, hub.hubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment request not found"));
        if (row.getStatus() != HubPaymentRequestStatus.ISSUED) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    row.getStatus() == HubPaymentRequestStatus.PAYMENT_PENDING
                            ? "Payment approval is already pending for this bill"
                            : "This bill is no longer open for payment");
        }

        String notes = mergePaymentNotes(body);
        HubPlatformPaymentSubmissionResponse submission = submissionService.submitForPaymentRequest(
                hubAdminUserId, row, body.getPaymentDate(), body.getPaymentReference(), notes, body.getTotalAmount());

        row.setStatus(HubPaymentRequestStatus.PAYMENT_PENDING);
        row.setSubmissionId(submission.getSubmissionId());
        row.setUpdatedBy(hubAdminUserId);
        requestRepository.save(row);
        return submission;
    }

    private CodDraft buildCodDraft(UUID townId, UUID hubId, LocalDate from, LocalDate to) {
        CodHubLedgerResponse ledger = codHubLedgerService.ledger(townId, hubId, null, null, hubId, true);
        BigDecimal balanceOwed = scale(ledger.getBalanceOwedToCompany());

        // Bill by order delivery date (IST), not close-day date — late close-days still belong to that delivery month.
        List<CodDeliveredItem> delivered;
        try {
            delivered = orderClient.getCodDeliveredRange(townId, null, from, to, false).items();
        } catch (RuntimeException ex) {
            delivered = List.of();
        }
        if (delivered == null) {
            delivered = List.of();
        }
        List<UUID> deliveredOrderIds = delivered.stream()
                .map(CodDeliveredItem::orderId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        List<CodLineDraft> lines = new ArrayList<>();
        if (!deliveredOrderIds.isEmpty()) {
            List<CodCloseDayLineItem> closeLines = codCloseDayLineItemRepository.findHubCloseLinesForOrders(
                    townId, hubId, CodCustodianType.HUB, deliveredOrderIds);
            Set<UUID> seenOrders = new HashSet<>();
            for (CodCloseDayLineItem item : closeLines) {
                if (item.getOrderId() == null || !seenOrders.add(item.getOrderId())) {
                    continue;
                }
                CodCloseDay close = item.getCloseDay();
                lines.add(new CodLineDraft(
                        item.getOrderId(),
                        item.getOrderNumber(),
                        close == null ? null : close.getCloseDate(),
                        scale(item.getAmount())));
            }
        }

        if (!lines.isEmpty()) {
            List<UUID> orderIds = lines.stream().map(CodLineDraft::orderId).toList();
            Set<UUID> blocked = new HashSet<>(codLineRepository.findBlockedOrderIds(orderIds, BLOCKING_STATUSES));
            lines.removeIf(l -> blocked.contains(l.orderId()));
        }

        lines.sort(Comparator.comparing(CodLineDraft::closeDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(CodLineDraft::orderNumber, Comparator.nullsLast(String::compareToIgnoreCase)));

        BigDecimal total = lines.stream()
                .map(CodLineDraft::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        String warning = null;
        if (total.compareTo(balanceOwed) > 0) {
            warning = "Period total exceeds current hub COD balance (₹" + balanceOwed
                    + ") — issue a smaller range or wait for close-days";
        } else if (total.compareTo(BigDecimal.ZERO) > 0 && total.compareTo(balanceOwed) < 0) {
            warning = "Partial period: ₹" + balanceOwed.subtract(total).setScale(2, RoundingMode.HALF_UP)
                    + " will remain on hub balance after this bill is paid in full.";
        }

        return new CodDraft(lines, total, balanceOwed, warning);
    }

    private static LocalDate[] resolvePeriod(
            HubPaymentRequestPeriodKind kind, LocalDate start, LocalDate end) {
        if (start == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "periodStart is required");
        }
        return switch (kind) {
            case DAILY -> {
                LocalDate day = start;
                yield new LocalDate[] { day, day };
            }
            case MONTHLY -> {
                LocalDate anchor = end != null ? end : start;
                yield new LocalDate[] {
                        anchor.withDayOfMonth(1),
                        anchor.withDayOfMonth(anchor.lengthOfMonth())
                };
            }
            case WEEKLY, CUSTOM -> {
                LocalDate to = end != null ? end : start;
                if (to.isBefore(start)) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "periodEnd must be on or after periodStart");
                }
                yield new LocalDate[] { start, to };
            }
        };
    }

    private HubPaymentRequestResponse toResponse(HubPaymentRequest row) {
        List<HubPaymentRequestResponse.CodLine> codLines = row.getRequestType() == HubPaymentRequestType.COD
                ? row.getCodLines().stream().map(this::toCodLineResponse).toList()
                : List.of();

        return HubPaymentRequestResponse.builder()
                .requestId(row.getId())
                .townId(row.getTownId())
                .hubId(row.getHubId())
                .requestType(row.getRequestType().name())
                .periodKind(row.getPeriodKind().name())
                .periodStart(row.getPeriodStart().toString())
                .periodEnd(row.getPeriodEnd().toString())
                .totalAmount(scale(row.getTotalAmount()))
                .franchiseLabel(row.getFranchiseLabel())
                .status(row.getStatus().name())
                .statusLabel(statusLabel(row.getStatus()))
                .documentRef(documentRef(row))
                .submissionId(row.getSubmissionId())
                .issuedAt(row.getCreatedAt())
                .orderCount(codLines.size())
                .codLines(codLines)
                .build();
    }

    private List<HubPaymentRequestResponse> toSummaries(List<HubPaymentRequest> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = rows.stream().map(HubPaymentRequest::getId).toList();
        Map<UUID, Integer> counts = new HashMap<>();
        for (Object[] row : codLineRepository.countByRequestIds(ids)) {
            counts.put((UUID) row[0], ((Number) row[1]).intValue());
        }
        return rows.stream().map(r -> toSummary(r, counts.getOrDefault(r.getId(), 0))).toList();
    }

    private HubPaymentRequestResponse toSummary(HubPaymentRequest row, int orderCount) {
        return HubPaymentRequestResponse.builder()
                .requestId(row.getId())
                .townId(row.getTownId())
                .hubId(row.getHubId())
                .requestType(row.getRequestType().name())
                .periodKind(row.getPeriodKind().name())
                .periodStart(row.getPeriodStart().toString())
                .periodEnd(row.getPeriodEnd().toString())
                .totalAmount(scale(row.getTotalAmount()))
                .franchiseLabel(row.getFranchiseLabel())
                .status(row.getStatus().name())
                .statusLabel(statusLabel(row.getStatus()))
                .documentRef(documentRef(row))
                .submissionId(row.getSubmissionId())
                .issuedAt(row.getCreatedAt())
                .orderCount(orderCount)
                .codLines(List.of())
                .build();
    }

    private static int clampSize(int size, int fallback, int max) {
        if (size < 1) {
            return fallback;
        }
        return Math.min(size, max);
    }

    private HubPaymentRequestResponse.CodLine toCodLineResponse(HubPaymentRequestCodLine line) {
        return HubPaymentRequestResponse.CodLine.builder()
                .lineId(line.getId())
                .orderId(line.getOrderId())
                .orderNumber(line.getOrderNumber())
                .closeDate(line.getCloseDate() == null ? null : line.getCloseDate().toString())
                .amount(scale(line.getAmount()))
                .build();
    }

    private HubPaymentRequestResponse.CodLine toCodLineResponse(CodLineDraft line) {
        return HubPaymentRequestResponse.CodLine.builder()
                .orderId(line.orderId())
                .orderNumber(line.orderNumber())
                .closeDate(line.closeDate() == null ? null : line.closeDate().toString())
                .amount(line.amount())
                .build();
    }

    private static String documentRef(HubPaymentRequest row) {
        if (row.getDocumentNumber() != null && !row.getDocumentNumber().isBlank()) {
            return row.getDocumentNumber();
        }
        String prefix = row.getRequestType() == HubPaymentRequestType.COD ? "COD" : "FR";
        return prefix + "-" + row.getPeriodStart() + "-" + row.getId().toString().substring(0, 8).toUpperCase();
    }

    private static String statusLabel(HubPaymentRequestStatus status) {
        return switch (status) {
            case ISSUED -> "Payment due";
            case PAYMENT_PENDING -> "Payment approval pending";
            case APPROVED -> "Approved";
            case CANCELLED -> "Cancelled";
        };
    }

    private static HubPaymentRequestType parseType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return HubPaymentRequestType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "type must be COD or FRANCHISE");
        }
    }

    private static HubPaymentRequestPeriodKind parsePeriodKind(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "periodKind is required");
        }
        try {
            return HubPaymentRequestPeriodKind.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "periodKind must be DAILY, WEEKLY, MONTHLY, or CUSTOM");
        }
    }

    private static String mergePaymentNotes(SubmitHubPaymentForRequest body) {
        StringBuilder sb = new StringBuilder();
        if (body.getPaymentMethod() != null && !body.getPaymentMethod().isBlank()) {
            sb.append(body.getPaymentMethod().trim());
        }
        if (body.getBankName() != null && !body.getBankName().isBlank()) {
            if (!sb.isEmpty()) {
                sb.append(" · ");
            }
            sb.append(body.getBankName().trim());
        }
        if (body.getHubNotes() != null && !body.getHubNotes().isBlank()) {
            if (!sb.isEmpty()) {
                sb.append(" · ");
            }
            sb.append(body.getHubNotes().trim());
        }
        return sb.isEmpty() ? null : sb.toString();
    }

    private static BigDecimal scale(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }

    private record CodLineDraft(UUID orderId, String orderNumber, LocalDate closeDate, BigDecimal amount) {}

    private record CodDraft(List<CodLineDraft> lines, BigDecimal total, BigDecimal balanceOwed, String warning) {}
}
