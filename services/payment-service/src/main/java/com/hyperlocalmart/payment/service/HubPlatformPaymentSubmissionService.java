package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.dto.request.CreateDeliverySettlementRequest;
import com.hyperlocalmart.payment.dto.request.ReviewHubPlatformPaymentRequest;
import com.hyperlocalmart.payment.dto.request.SubmitHubPlatformPaymentRequest;
import com.hyperlocalmart.payment.dto.request.UpdateHubPlatformPaymentRequest;
import com.hyperlocalmart.payment.dto.response.CodHubLedgerResponse;
import com.hyperlocalmart.payment.dto.response.DeliverySettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.HubPlatformPaymentPayableResponse;
import com.hyperlocalmart.payment.dto.response.HubPlatformPaymentReceiptResponse;
import com.hyperlocalmart.payment.dto.response.HubPlatformPaymentSubmissionResponse;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.entity.*;
import com.hyperlocalmart.payment.repository.HubPaymentRequestRepository;
import com.hyperlocalmart.payment.repository.HubPlatformPaymentSubmissionLineRepository;
import com.hyperlocalmart.payment.repository.HubPlatformPaymentSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HubPlatformPaymentSubmissionService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String PENDING_LABEL = "Payment confirmation pending by KoyaKart";

    private final DeliveryClient deliveryClient;
    private final DeliverySettlementService deliverySettlementService;
    private final CodHubLedgerService codHubLedgerService;
    private final HubPlatformPaymentSubmissionRepository submissionRepository;
    private final HubPlatformPaymentSubmissionLineRepository submissionLineRepository;
    private final HubPaymentRequestRepository hubPaymentRequestRepository;

    @Transactional(readOnly = true)
    public HubPlatformPaymentPayableResponse payable(UUID hubAdminUserId) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        return buildPayable(hub.townId(), hub.hubId(), hubAdminUserId);
    }

    @Transactional(readOnly = true)
    public HubPlatformPaymentPayableResponse payableForHub(UUID townId, UUID hubId, UUID actorUserId, boolean superAdmin) {
        assertHubScope(actorUserId, townId, hubId, superAdmin);
        return buildPayable(townId, hubId, actorUserId);
    }

    @Transactional(readOnly = true)
    public List<HubPlatformPaymentSubmissionResponse> listForHub(UUID hubAdminUserId) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        return submissionRepository.findByHubIdOrderByCreatedAtDesc(hub.hubId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public HubPlatformPaymentReceiptResponse receiptForHub(UUID hubAdminUserId, UUID submissionId) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        HubPlatformPaymentSubmission submission = submissionRepository
                .findDetailedByIdAndHubId(submissionId, hub.hubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment submission not found"));
        if (submission.getStatus() != HubPlatformPaymentSubmissionStatus.VERIFIED) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Receipt is available only after KoyaKart confirms the payment");
        }
        return toReceipt(submission, hub.hubName());
    }

    @Transactional(readOnly = true)
    public List<HubPlatformPaymentSubmissionResponse> listForAdmin(UUID townId, UUID hubId, UUID actorUserId) {
        if (hubId != null) {
            return submissionRepository.findByTownIdAndHubIdOrderByCreatedAtDesc(townId, hubId).stream()
                    .map(this::toResponse)
                    .toList();
        }
        return submissionRepository.findByTownIdAndStatusOrderByCreatedAtDesc(
                        townId, HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public HubPlatformPaymentSubmissionResponse updatePending(
            UUID hubAdminUserId, UUID submissionId, UpdateHubPlatformPaymentRequest request) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        HubPlatformPaymentSubmission submission = submissionRepository
                .findDetailedByIdAndHubId(submissionId, hub.hubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment submission not found"));
        if (submission.getStatus() == HubPlatformPaymentSubmissionStatus.VERIFIED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Confirmed payments cannot be edited.");
        }
        boolean resubmitRejected = submission.getStatus() == HubPlatformPaymentSubmissionStatus.REJECTED;
        if (submission.getStatus() == HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION
                && submission.isHubDetailsLocked()) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "This payment is already submitted and cannot be edited.");
        }
        if (submission.getStatus() != HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION
                && !resubmitRejected) {
            throw new BusinessException(ErrorCode.CONFLICT, "This payment cannot be edited.");
        }
        String ref = trimRequired(request.getPaymentReference(), "Payment reference (UTR / txn id) is required");
        if (ref.length() > 120) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Payment reference is too long");
        }
        LocalDate payDate = request.getPaymentDate() != null ? request.getPaymentDate() : submission.getPaymentDate();
        if (payDate.isAfter(LocalDate.now(IST))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Payment date cannot be in the future");
        }
        submission.setPaymentDate(payDate);
        submission.setPaymentReference(ref);
        submission.setHubNotes(trimToNull(request.getHubNotes()));
        submission.setHubDetailsLocked(true);
        submission.setUpdatedBy(hubAdminUserId);
        if (resubmitRejected) {
            relinkRejectedForResubmit(submission, hubAdminUserId);
            submission.setStatus(HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION);
            submission.setRejectedAt(null);
            submission.setRejectedBy(null);
            submission.setAdminNotes(null);
        }
        return toResponse(submissionRepository.save(submission));
    }

    @Transactional
    public HubPlatformPaymentSubmissionResponse submitForPaymentRequest(
            UUID hubAdminUserId,
            HubPaymentRequest paymentRequest,
            LocalDate paymentDate,
            String paymentReference,
            String hubNotes,
            BigDecimal totalAmount) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        if (!hub.hubId().equals(paymentRequest.getHubId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This bill belongs to another hub");
        }
        if (paymentRequest.getStatus() != HubPaymentRequestStatus.ISSUED) {
            throw new BusinessException(ErrorCode.CONFLICT, "This bill is not open for payment");
        }
        HubPlatformPaymentLineType lineType = paymentRequest.getRequestType() == HubPaymentRequestType.COD
                ? HubPlatformPaymentLineType.COD_REMITTANCE
                : HubPlatformPaymentLineType.FRANCHISE_FEE;
        if (submissionRepository.existsPendingWithLineType(
                hub.hubId(), HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION, lineType)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "You already have a "
                            + (lineType == HubPlatformPaymentLineType.COD_REMITTANCE ? "COD" : "franchise")
                            + " payment awaiting KoyaKart confirmation.");
        }

        BigDecimal expected = scale(paymentRequest.getTotalAmount());
        BigDecimal submittedTotal = scale(totalAmount);
        if (submittedTotal.compareTo(expected) != 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Total must be exactly " + expected + ". Refresh the bill and try again.");
        }

        String ref = trimRequired(paymentReference, "Payment reference (UTR / txn id) is required");
        LocalDate payDate = paymentDate != null ? paymentDate : LocalDate.now(IST);

        List<HubPlatformPaymentSubmissionLine> lineDrafts = new ArrayList<>();
        if (paymentRequest.getRequestType() == HubPaymentRequestType.COD) {
            lineDrafts.add(HubPlatformPaymentSubmissionLine.builder()
                    .lineType(HubPlatformPaymentLineType.COD_REMITTANCE)
                    .amount(expected)
                    .build());
        } else if (paymentRequest.getRequestType() == HubPaymentRequestType.FRANCHISE) {
            lineDrafts.add(HubPlatformPaymentSubmissionLine.builder()
                    .lineType(HubPlatformPaymentLineType.FRANCHISE_FEE)
                    .amount(expected)
                    .franchisePeriodStart(paymentRequest.getPeriodStart())
                    .franchisePeriodEnd(paymentRequest.getPeriodEnd())
                    .franchiseLabel(paymentRequest.getFranchiseLabel())
                    .build());
        } else {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown payment request type");
        }

        HubPlatformPaymentSubmission submission = HubPlatformPaymentSubmission.builder()
                .townId(hub.townId())
                .hubId(hub.hubId())
                .paymentDate(payDate)
                .totalAmount(submittedTotal)
                .paymentReference(ref)
                .hubNotes(trimToNull(hubNotes))
                .status(HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION)
                .paymentRequestId(paymentRequest.getId())
                .hubDetailsLocked(true)
                .build();
        submission.setCreatedBy(hubAdminUserId);
        submission.setUpdatedBy(hubAdminUserId);

        for (HubPlatformPaymentSubmissionLine draft : lineDrafts) {
            draft.setSubmission(submission);
            draft.setCreatedBy(hubAdminUserId);
            draft.setUpdatedBy(hubAdminUserId);
            submission.getLines().add(draft);
        }

        return toResponse(submissionRepository.save(submission));
    }

    @Transactional
    public HubPlatformPaymentSubmissionResponse submit(UUID hubAdminUserId, SubmitHubPlatformPaymentRequest request) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        if (submissionRepository.existsByHubIdAndStatus(hub.hubId(), HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "You already have a payment awaiting KoyaKart confirmation. Wait for verification or ask support to reject it.");
        }
        throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                "Pay from an open COD or Franchise bill on the Accounts screen — combined payments are no longer supported.");
    }

    @Transactional
    public HubPlatformPaymentSubmissionResponse verify(UUID submissionId, UUID adminUserId, ReviewHubPlatformPaymentRequest request) {
        HubPlatformPaymentSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment submission not found"));
        if (submission.getStatus() != HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION) {
            throw new BusinessException(ErrorCode.CONFLICT, "Submission is not pending verification");
        }

        revalidateBeforeVerify(submission);

        String hubPayeeName = resolveHubPayeeName(submission);
        Instant now = Instant.now();
        for (HubPlatformPaymentSubmissionLine line : submission.getLines()) {
            if (line.getLineType() == HubPlatformPaymentLineType.COD_REMITTANCE) {
                CodHubPlatformRemittance remittance = CodHubPlatformRemittance.builder()
                        .townId(submission.getTownId())
                        .hubId(submission.getHubId())
                        .remittanceDate(submission.getPaymentDate())
                        .amount(scale(line.getAmount()))
                        .reference(submission.getPaymentReference())
                        .notes(mergeNotes(submission))
                        .submissionId(submission.getId())
                        .build();
                remittance.setCreatedBy(adminUserId);
                remittance.setUpdatedBy(adminUserId);
                remittance = saveRemittance(remittance);
                line.setCodRemittanceId(remittance.getId());
            } else if (line.getLineType() == HubPlatformPaymentLineType.FRANCHISE_FEE) {
                CreateDeliverySettlementRequest franchiseReq = new CreateDeliverySettlementRequest();
                franchiseReq.setTownId(submission.getTownId());
                franchiseReq.setPayeeType(SettlementPayeeType.HUB);
                franchiseReq.setPayeeId(submission.getHubId());
                franchiseReq.setPayeeName(hubPayeeName);
                franchiseReq.setPeriodStart(line.getFranchisePeriodStart());
                franchiseReq.setPeriodEnd(line.getFranchisePeriodEnd());
                franchiseReq.setKind("FRANCHISE");
                franchiseReq.setMarkPaid(true);
                franchiseReq.setPayoutMethod("ONLINE");
                franchiseReq.setTransactionReference(submission.getPaymentReference());
                franchiseReq.setTransactionNotes(mergeNotes(submission));
                franchiseReq.setPaidAt(now);
                SettlementResponse saved = deliverySettlementService.create(adminUserId, franchiseReq);
                if (saved.getNetAmount().setScale(2, RoundingMode.HALF_UP).compareTo(scale(line.getAmount())) != 0) {
                    throw new BusinessException(ErrorCode.CONFLICT,
                            "Franchise amount changed since submission; reject and ask hub to resubmit");
                }
                line.setFranchiseSettlementId(saved.getId());
            }
        }

        submission.setStatus(HubPlatformPaymentSubmissionStatus.VERIFIED);
        submission.setVerifiedAt(now);
        submission.setVerifiedBy(adminUserId);
        submission.setAdminNotes(trimToNull(request == null ? null : request.getAdminNotes()));
        submission.setUpdatedBy(adminUserId);
        HubPlatformPaymentSubmission saved = submissionRepository.save(submission);
        syncPaymentRequestAfterVerify(saved, adminUserId);
        return toResponse(saved);
    }

    @Transactional
    public HubPlatformPaymentSubmissionResponse reject(UUID submissionId, UUID adminUserId, ReviewHubPlatformPaymentRequest request) {
        HubPlatformPaymentSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment submission not found"));
        if (submission.getStatus() != HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION) {
            throw new BusinessException(ErrorCode.CONFLICT, "Submission is not pending verification");
        }
        submission.setStatus(HubPlatformPaymentSubmissionStatus.REJECTED);
        submission.setRejectedAt(Instant.now());
        submission.setRejectedBy(adminUserId);
        submission.setAdminNotes(trimRequired(
                request == null ? null : request.getAdminNotes(),
                "Add a short reason so the hub knows why payment was rejected"));
        submission.setHubDetailsLocked(false);
        submission.setUpdatedBy(adminUserId);
        HubPlatformPaymentSubmission saved = submissionRepository.save(submission);
        syncPaymentRequestAfterReject(saved, adminUserId);
        return toResponse(saved);
    }

    private void syncPaymentRequestAfterVerify(HubPlatformPaymentSubmission submission, UUID adminUserId) {
        if (submission.getPaymentRequestId() == null) {
            return;
        }
        hubPaymentRequestRepository.findById(submission.getPaymentRequestId()).ifPresent(req -> {
            if (req.getSubmissionId() != null && !req.getSubmissionId().equals(submission.getId())) {
                return;
            }
            req.setStatus(HubPaymentRequestStatus.APPROVED);
            req.setUpdatedBy(adminUserId);
            hubPaymentRequestRepository.save(req);
        });
    }

    private void syncPaymentRequestAfterReject(HubPlatformPaymentSubmission submission, UUID adminUserId) {
        if (submission.getPaymentRequestId() == null) {
            return;
        }
        hubPaymentRequestRepository.findById(submission.getPaymentRequestId()).ifPresent(req -> {
            if (req.getStatus() != HubPaymentRequestStatus.PAYMENT_PENDING) {
                return;
            }
            req.setStatus(HubPaymentRequestStatus.ISSUED);
            req.setSubmissionId(null);
            req.setUpdatedBy(adminUserId);
            hubPaymentRequestRepository.save(req);
        });
    }

    private void revalidateBeforeVerify(HubPlatformPaymentSubmission submission) {
        CodHubLedgerResponse ledger = codHubLedgerService.ledger(
                submission.getTownId(),
                submission.getHubId(),
                null,
                null,
                submission.getCreatedBy(),
                true);

        LocalDate today = LocalDate.now(IST);
        for (HubPlatformPaymentSubmissionLine line : submission.getLines()) {
            if (line.getLineType() == HubPlatformPaymentLineType.COD_REMITTANCE) {
                BigDecimal owed = scale(ledger.getBalanceOwedToCompany());
                if (line.getAmount().compareTo(owed) > 0) {
                    throw new BusinessException(ErrorCode.CONFLICT,
                            "COD owed is now " + owed + "; submission was " + line.getAmount() + ". Reject and ask hub to resubmit.");
                }
                if (submission.getPaymentRequestId() != null && line.getAmount().compareTo(scale(submission.getTotalAmount())) != 0) {
                    throw new BusinessException(ErrorCode.CONFLICT, "COD submission amount does not match bill");
                }
            } else if (line.getLineType() == HubPlatformPaymentLineType.FRANCHISE_FEE) {
                LocalDate fStart = line.getFranchisePeriodStart() != null
                        ? line.getFranchisePeriodStart()
                        : today.withDayOfMonth(1);
                LocalDate fEnd = line.getFranchisePeriodEnd() != null
                        ? line.getFranchisePeriodEnd()
                        : today;
                DeliverySettlementCandidateView candidates = deliverySettlementService.listCandidates(
                        submission.getTownId(),
                        SettlementPayeeType.HUB,
                        submission.getHubId(),
                        fStart,
                        fEnd);
                DeliverySettlementCandidateView.FranchiseDue franchise = candidates.getFranchise();
                if (franchise == null || !franchise.isEnabled() || franchise.isAlreadyCollected()) {
                    throw new BusinessException(ErrorCode.CONFLICT, "Franchise is no longer due; reject this submission.");
                }
                if (scale(franchise.getAmount()).compareTo(scale(line.getAmount())) != 0) {
                    throw new BusinessException(ErrorCode.CONFLICT,
                            "Franchise due is now " + franchise.getAmount() + "; reject and ask hub to resubmit.");
                }
            }
        }

        BigDecimal lineSum = submission.getLines().stream()
                .map(l -> scale(l.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (lineSum.compareTo(scale(submission.getTotalAmount())) != 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "Submission line totals do not match header amount");
        }
    }

    private HubPlatformPaymentPayableResponse buildPayable(UUID townId, UUID hubId, UUID actorUserId) {
        LocalDate today = LocalDate.now(IST);
        CodHubLedgerResponse ledger = codHubLedgerService.ledger(townId, hubId, null, null, actorUserId, false);
        DeliverySettlementCandidateView candidates = deliverySettlementService.listCandidates(
                townId, SettlementPayeeType.HUB, hubId, today.withDayOfMonth(1), today);

        DeliverySettlementCandidateView.FranchiseDue franchise = candidates.getFranchise();
        boolean franchiseEnabled = franchise != null && franchise.isEnabled();
        BigDecimal franchiseAmount = franchiseEnabled ? scale(franchise.getAmount()) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        boolean codPending = submissionLineRepository.existsPendingLineOfType(
                hubId, HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION, HubPlatformPaymentLineType.COD_REMITTANCE);
        boolean franchisePending = false;
        if (franchiseEnabled && franchise != null) {
            franchisePending = submissionLineRepository.existsPendingFranchiseForPeriod(
                    hubId,
                    HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION,
                    HubPlatformPaymentLineType.FRANCHISE_FEE,
                    LocalDate.parse(franchise.getPeriodStart()),
                    LocalDate.parse(franchise.getPeriodEnd()));
        }

        BigDecimal codOwed = scale(ledger.getBalanceOwedToCompany());
        boolean codPayable = codOwed.compareTo(BigDecimal.ZERO) > 0 && !codPending;
        boolean franchisePayable = franchiseEnabled
                && franchise != null
                && !franchise.isAlreadyCollected()
                && franchiseAmount.compareTo(BigDecimal.ZERO) > 0
                && !franchisePending;

        BigDecimal suggested = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (codPayable) {
            suggested = suggested.add(codOwed);
        }
        if (franchisePayable) {
            suggested = suggested.add(franchiseAmount);
        }

        boolean hasPending = submissionRepository.existsByHubIdAndStatus(
                hubId, HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION);

        return HubPlatformPaymentPayableResponse.builder()
                .hubId(hubId)
                .townId(townId)
                .codOwedToCompany(codOwed)
                .codPayable(codPayable)
                .codPendingVerification(codPending)
                .franchiseEnabled(franchiseEnabled)
                .franchiseAmount(franchiseAmount)
                .franchisePeriodStart(franchiseEnabled && franchise != null ? franchise.getPeriodStart() : null)
                .franchisePeriodEnd(franchiseEnabled && franchise != null ? franchise.getPeriodEnd() : null)
                .franchiseLabel(franchiseEnabled && franchise != null ? franchise.getLabel() : null)
                .franchisePayable(franchisePayable)
                .franchisePendingVerification(franchisePending)
                .suggestedTotal(suggested)
                .hasPendingSubmission(hasPending)
                .pendingStatusLabel(hasPending ? PENDING_LABEL : null)
                .build();
    }

    private HubPlatformPaymentReceiptResponse toReceipt(HubPlatformPaymentSubmission row, String hubName) {
        List<HubPlatformPaymentReceiptResponse.Line> lines = row.getLines().stream()
                .map(l -> HubPlatformPaymentReceiptResponse.Line.builder()
                        .lineId(l.getId())
                        .lineType(l.getLineType().name())
                        .lineDescription(lineDescription(l))
                        .amount(scale(l.getAmount()))
                        .franchisePeriodStart(l.getFranchisePeriodStart() == null ? null : l.getFranchisePeriodStart().toString())
                        .franchisePeriodEnd(l.getFranchisePeriodEnd() == null ? null : l.getFranchisePeriodEnd().toString())
                        .franchiseLabel(l.getFranchiseLabel())
                        .codRemittanceId(l.getCodRemittanceId())
                        .franchiseSettlementId(l.getFranchiseSettlementId())
                        .build())
                .toList();

        BigDecimal linesTotal = lines.stream()
                .map(HubPlatformPaymentReceiptResponse.Line::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = scale(row.getTotalAmount());
        boolean consistent = linesTotal.compareTo(total) == 0;

        String receiptNumber = "KK-HUB-" + row.getId().toString().substring(0, 8).toUpperCase();

        return HubPlatformPaymentReceiptResponse.builder()
                .receiptNumber(receiptNumber)
                .submissionId(row.getId())
                .townId(row.getTownId())
                .hubId(row.getHubId())
                .hubName(hubName == null || hubName.isBlank() ? "Delivery hub" : hubName.trim())
                .status(row.getStatus().name())
                .statusLabel(statusLabel(row.getStatus()))
                .documentTitle("Payment receipt · Hub to KoyaKart")
                .paymentDate(row.getPaymentDate().toString())
                .totalAmount(total)
                .linesTotal(linesTotal)
                .amountsConsistent(consistent)
                .paymentReference(row.getPaymentReference())
                .hubNotes(row.getHubNotes())
                .adminNotes(row.getAdminNotes())
                .submittedAt(row.getCreatedAt())
                .verifiedAt(row.getVerifiedAt())
                .generatedAt(Instant.now())
                .lines(lines)
                .build();
    }

    private static String lineDescription(HubPlatformPaymentSubmissionLine line) {
        if (line.getLineType() == HubPlatformPaymentLineType.COD_REMITTANCE) {
            return "COD remittance to KoyaKart";
        }
        if (line.getFranchiseLabel() != null && !line.getFranchiseLabel().isBlank()) {
            return "Franchise fee · " + line.getFranchiseLabel().trim();
        }
        return "Franchise fee";
    }

    private HubPlatformPaymentSubmissionResponse toResponse(HubPlatformPaymentSubmission row) {
        List<HubPlatformPaymentSubmissionResponse.Line> lines = row.getLines().stream()
                .map(l -> HubPlatformPaymentSubmissionResponse.Line.builder()
                        .lineId(l.getId())
                        .lineType(l.getLineType().name())
                        .amount(scale(l.getAmount()))
                        .franchisePeriodStart(l.getFranchisePeriodStart() == null ? null : l.getFranchisePeriodStart().toString())
                        .franchisePeriodEnd(l.getFranchisePeriodEnd() == null ? null : l.getFranchisePeriodEnd().toString())
                        .franchiseLabel(l.getFranchiseLabel())
                        .build())
                .toList();

        return HubPlatformPaymentSubmissionResponse.builder()
                .submissionId(row.getId())
                .townId(row.getTownId())
                .hubId(row.getHubId())
                .status(row.getStatus().name())
                .statusLabel(statusLabel(row.getStatus()))
                .paymentDate(row.getPaymentDate().toString())
                .totalAmount(scale(row.getTotalAmount()))
                .paymentReference(row.getPaymentReference())
                .hubNotes(row.getHubNotes())
                .adminNotes(row.getAdminNotes())
                .submittedAt(row.getCreatedAt())
                .verifiedAt(row.getVerifiedAt())
                .rejectedAt(row.getRejectedAt())
                .editable(isHubEditable(row))
                .lines(lines)
                .build();
    }

    private void relinkRejectedForResubmit(HubPlatformPaymentSubmission submission, UUID hubAdminUserId) {
        HubPlatformPaymentLineType lineType = submission.getLines().stream()
                .map(HubPlatformPaymentSubmissionLine::getLineType)
                .findFirst()
                .orElse(null);
        if (lineType != null && submissionRepository.existsPendingWithLineType(
                submission.getHubId(), HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION, lineType)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "A newer payment is already awaiting KoyaKart confirmation.");
        }
        if (submission.getPaymentRequestId() == null) {
            return;
        }
        HubPaymentRequest req = hubPaymentRequestRepository.findById(submission.getPaymentRequestId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Payment bill not found"));
        if (req.getStatus() == HubPaymentRequestStatus.APPROVED) {
            throw new BusinessException(ErrorCode.CONFLICT, "This bill is already confirmed.");
        }
        if (req.getStatus() == HubPaymentRequestStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "This bill was cancelled.");
        }
        if (req.getStatus() == HubPaymentRequestStatus.PAYMENT_PENDING
                && req.getSubmissionId() != null
                && !req.getSubmissionId().equals(submission.getId())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "A newer payment is already awaiting KoyaKart confirmation.");
        }
        req.setStatus(HubPaymentRequestStatus.PAYMENT_PENDING);
        req.setSubmissionId(submission.getId());
        req.setUpdatedBy(hubAdminUserId);
        hubPaymentRequestRepository.save(req);
    }

    private static boolean isHubEditable(HubPlatformPaymentSubmission row) {
        if (row.getStatus() == HubPlatformPaymentSubmissionStatus.REJECTED) {
            return true;
        }
        return row.getStatus() == HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION
                && !row.isHubDetailsLocked();
    }

    private static String statusLabel(HubPlatformPaymentSubmissionStatus status) {
        return switch (status) {
            case PENDING_VERIFICATION -> PENDING_LABEL;
            case VERIFIED -> "Confirmed by KoyaKart";
            case REJECTED -> "Rejected by KoyaKart";
        };
    }

    private CodHubPlatformRemittance saveRemittance(CodHubPlatformRemittance remittance) {
        return codHubLedgerService.saveVerifiedRemittance(remittance);
    }

    private String resolveHubPayeeName(HubPlatformPaymentSubmission submission) {
        if (submission.getCreatedBy() != null) {
            try {
                DeliveryClient.HubAdminContext ctx = deliveryClient.getHubAdminContext(submission.getCreatedBy());
                if (ctx.hubId().equals(submission.getHubId())
                        && ctx.hubName() != null
                        && !ctx.hubName().isBlank()) {
                    return ctx.hubName().trim();
                }
            } catch (BusinessException ignored) {
                // fall through
            }
        }
        return null;
    }

    private static String mergeNotes(HubPlatformPaymentSubmission submission) {
        String hub = submission.getHubNotes();
        String ref = submission.getPaymentReference();
        if (hub == null || hub.isBlank()) {
            return "Hub online payment · ref " + ref;
        }
        return hub.trim() + " · ref " + ref;
    }

    private void assertHubScope(UUID actorUserId, UUID townId, UUID hubId, boolean superAdmin) {
        if (superAdmin) {
            return;
        }
        DeliveryClient.HubAdminContext ctx = deliveryClient.getHubAdminContext(actorUserId);
        if (!ctx.hubId().equals(hubId) || !ctx.townId().equals(townId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub/town does not match your assignment");
        }
    }

    private static BigDecimal scale(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String trimRequired(String s, String message) {
        String t = s == null ? "" : s.trim();
        if (t.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
        return t;
    }
}
