package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.client.UserClient;
import com.hyperlocalmart.payment.config.PaymentProperties;
import com.hyperlocalmart.payment.dto.request.ConfirmGatewayPaymentRequest;
import com.hyperlocalmart.payment.dto.request.ConfirmMembershipCashRequest;
import com.hyperlocalmart.payment.dto.request.ConsumeMembershipRequest;
import com.hyperlocalmart.payment.dto.request.GiftMembershipRequest;
import com.hyperlocalmart.payment.dto.request.PurchaseMembershipRequest;
import com.hyperlocalmart.payment.dto.request.RestoreMembershipRequest;
import com.hyperlocalmart.payment.dto.response.ConsumeMembershipResponse;
import com.hyperlocalmart.payment.dto.response.GatewayCheckoutResponse;
import com.hyperlocalmart.payment.dto.response.MembershipCatalogResponse;
import com.hyperlocalmart.payment.dto.response.MembershipCatalogResponse.SlabOffer;
import com.hyperlocalmart.payment.dto.response.MembershipMeResponse;
import com.hyperlocalmart.payment.dto.response.MembershipMemberRow;
import com.hyperlocalmart.payment.dto.response.MembershipPurchaseResponse;
import com.hyperlocalmart.payment.dto.response.MembershipReportResponse;
import com.hyperlocalmart.payment.dto.response.MembershipReportResponse.NamedCount;
import com.hyperlocalmart.payment.entity.BuyerMembership;
import com.hyperlocalmart.payment.entity.BuyerMembershipLedger;
import com.hyperlocalmart.payment.entity.BuyerMembershipPurchase;
import com.hyperlocalmart.payment.entity.MembershipLedgerType;
import com.hyperlocalmart.payment.entity.MembershipPaymentChannel;
import com.hyperlocalmart.payment.entity.MembershipPurchaseStatus;
import com.hyperlocalmart.payment.entity.MembershipSlab;
import com.hyperlocalmart.payment.repository.BuyerMembershipLedgerRepository;
import com.hyperlocalmart.payment.repository.BuyerMembershipPurchaseRepository;
import com.hyperlocalmart.payment.repository.BuyerMembershipRepository;
import com.hyperlocalmart.payment.razorpay.RazorpayClient;
import com.hyperlocalmart.payment.razorpay.RazorpayMoney;
import com.hyperlocalmart.payment.razorpay.RazorpayOrder;
import com.hyperlocalmart.payment.razorpay.RazorpayPayment;
import com.hyperlocalmart.payment.razorpay.RazorpaySignatures;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MembershipService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;

    private final BuyerMembershipRepository membershipRepository;
    private final BuyerMembershipPurchaseRepository purchaseRepository;
    private final BuyerMembershipLedgerRepository ledgerRepository;
    private final TownClient townClient;
    private final UserClient userClient;
    private final RazorpayClient razorpayClient;
    private final PaymentProperties paymentProperties;
    private final TransactionTemplate transactionTemplate;

    @Transactional(readOnly = true)
    public MembershipCatalogResponse catalog(UUID buyerId, String phone, UUID townId) {
        TownClient.MembershipConfig config = townClient.membershipConfig();
        boolean townSells = true;
        if (townId != null) {
            townSells = townClient.townConfig(townId).sellsMembership();
        }
        String blockReason = null;
        if (!config.enabled()) {
            blockReason = "Membership is not on sale right now";
        } else if (townId == null) {
            blockReason = "Select a town first";
        } else if (!townSells) {
            blockReason = "Membership is not sold in this town. You can still use leftover credits here.";
        }
        boolean canPurchase = blockReason == null;
        List<SlabOffer> slabs = List.of(
                offer(config.quarterly(), "3 months", canPurchase),
                offer(config.halfYear(), "6 months", canPurchase),
                offer(config.annual(), "12 months", canPurchase)
        );
        return MembershipCatalogResponse.builder()
                .platformEnabled(config.enabled())
                .townSells(townSells)
                .canPurchase(canPurchase)
                .blockReason(blockReason)
                .mine(buyerId == null ? emptyMine() : mine(buyerId))
                .slabs(slabs)
                .build();
    }

    @Transactional(readOnly = true)
    public MembershipMeResponse mine(UUID buyerId) {
        BuyerMembership membership = membershipRepository.findByBuyerId(buyerId).orElse(null);
        BuyerMembershipPurchase pending = purchaseRepository
                .findFirstByBuyerIdAndStatusOrderByCreatedAtDesc(buyerId, MembershipPurchaseStatus.PENDING_CASH)
                .orElse(null);
        List<MembershipPurchaseResponse> recent = purchaseRepository.findByBuyerIdOrderByCreatedAtDesc(buyerId)
                .stream()
                .limit(8)
                .map(this::toPurchase)
                .toList();
        if (membership == null) {
            return MembershipMeResponse.builder()
                    .active(false)
                    .creditsRemaining(0)
                    .usableCredits(0)
                    .expiresAt(null)
                    .lastSlab(null)
                    .pendingCashPurchaseId(pending == null ? null : pending.getId().toString())
                    .recentPurchases(recent)
                    .build();
        }
        int usable = usableCredits(membership);
        return MembershipMeResponse.builder()
                .active(usable > 0)
                .creditsRemaining(membership.getCreditsRemaining())
                .usableCredits(usable)
                .expiresAt(membership.getExpiresAt())
                .lastSlab(membership.getLastSlab().name())
                .pendingCashPurchaseId(pending == null ? null : pending.getId().toString())
                .recentPurchases(recent)
                .build();
    }

    public MembershipPurchaseResponse purchase(UUID buyerId, String phone, PurchaseMembershipRequest request) {
        MembershipSlab slab = parseSlab(request.getSlab());
        MembershipPaymentChannel channel = parseChannel(request.getChannel());
        if (channel == MembershipPaymentChannel.ADMIN_GIFT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Use the gift action in Super Admin");
        }
        TownClient.MembershipConfig config = townClient.membershipConfig();
        if (!config.enabled()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Membership is not on sale right now");
        }
        if (request.getTownId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Select a town first");
        }
        if (!townClient.townConfig(request.getTownId()).sellsMembership()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Membership is not sold in this town");
        }
        TownClient.Slab offer = requireSellableSlab(config, slab);

        UUID purchaseId = transactionTemplate.execute(status -> {
            assertNoPendingCash(buyerId);
            BuyerMembershipPurchase purchase = BuyerMembershipPurchase.builder()
                    .buyerId(buyerId)
                    .buyerPhoneSnapshot(phone)
                    .townId(request.getTownId())
                    .slab(slab)
                    .durationMonths(slab.months())
                    .creditsGranted(offer.credits())
                    .priceSnapshot(money(offer.price()))
                    .paymentChannel(channel)
                    .status(channel == MembershipPaymentChannel.CASH
                            ? MembershipPurchaseStatus.PENDING_CASH
                            : MembershipPurchaseStatus.PENDING_PAYMENT)
                    .note(channel == MembershipPaymentChannel.CASH ? "Pay cash at hub" : "Online")
                    .build();
            purchaseRepository.save(purchase);
            if (channel == MembershipPaymentChannel.ONLINE && paymentProperties.isRazorpayConfigured()) {
                cancelPendingOnline(buyerId);
                purchaseRepository.save(purchase);
            }
            return purchase.getId();
        });

        BuyerMembershipPurchase purchase = purchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Membership purchase missing"));

        if (channel == MembershipPaymentChannel.ONLINE) {
            if (paymentProperties.isRazorpayConfigured()) {
                long paise = RazorpayMoney.toPaise(purchase.getPriceSnapshot());
                Map<String, String> notes = new LinkedHashMap<>();
                notes.put("hlm_kind", "MEMBERSHIP");
                notes.put("hlm_purchase_id", purchase.getId().toString());
                RazorpayOrder rzp = razorpayClient.createOrder(
                        paise, purchase.getId().toString().replace("-", ""), notes);
                transactionTemplate.executeWithoutResult(status -> {
                    BuyerMembershipPurchase row = purchaseRepository.findById(purchaseId)
                            .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Membership purchase missing"));
                    row.setGatewayOrderId(rzp.id());
                    purchaseRepository.save(row);
                });
                purchase = purchaseRepository.findById(purchaseId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Membership purchase missing"));
                return toPurchase(purchase);
            }
            transactionTemplate.executeWithoutResult(status -> {
                BuyerMembershipPurchase row = purchaseRepository.findById(purchaseId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Membership purchase missing"));
                grantPaid(row, null, "Online purchase");
            });
            purchase = purchaseRepository.findById(purchaseId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Membership purchase missing"));
        }
        return toPurchase(purchase);
    }

    @Transactional
    public MembershipPurchaseResponse gift(UUID adminId, GiftMembershipRequest request) {
        MembershipSlab slab = parseSlab(request.getSlab());
        UserClient.UserProfile user = userClient.findByPhone(normalizePhone(request.getPhone()));
        if (!user.isBuyer()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "That phone is not a buyer account");
        }
        TownClient.MembershipConfig config = townClient.membershipConfig();
        TownClient.Slab offer = config.slab(slab.name());
        if (offer == null || offer.credits() <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Set free deliveries on this slab before gifting");
        }
        voidOtherPendingCash(user.id(), null);
        BuyerMembershipPurchase purchase = BuyerMembershipPurchase.builder()
                .buyerId(user.id())
                .buyerPhoneSnapshot(user.phone())
                .slab(slab)
                .durationMonths(slab.months())
                .creditsGranted(offer.credits())
                .priceSnapshot(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .paymentChannel(MembershipPaymentChannel.ADMIN_GIFT)
                .status(MembershipPurchaseStatus.PENDING_PAYMENT)
                .note(request.getNote() == null || request.getNote().isBlank() ? "Admin gift" : request.getNote().trim())
                .build();
        purchaseRepository.save(purchase);
        grantPaid(purchase, adminId, purchase.getNote());
        return toPurchase(purchase);
    }

    @Transactional
    public MembershipPurchaseResponse confirmCash(UUID actorId, ConfirmMembershipCashRequest request) {
        BuyerMembershipPurchase purchase = resolvePendingCash(request);
        grantPaid(purchase, actorId, "Cash received");
        return toPurchase(purchase);
    }

    @Transactional
    public MembershipPurchaseResponse confirmOnline(UUID buyerId, ConfirmGatewayPaymentRequest request) {
        RazorpaySignatures.verifyPayment(
                request.getRazorpayOrderId(),
                request.getRazorpayPaymentId(),
                request.getRazorpaySignature(),
                paymentProperties.getRazorpayKeySecret());
        BuyerMembershipPurchase purchase = purchaseRepository.findByGatewayOrderId(request.getRazorpayOrderId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Membership payment not found"));
        if (!purchase.getBuyerId().equals(buyerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Purchase does not belong to buyer");
        }
        if (paymentProperties.isRazorpayConfigured()) {
            RazorpayPayment fetched = razorpayClient.fetchPayment(request.getRazorpayPaymentId());
            if (fetched.orderId() != null && !fetched.orderId().equals(request.getRazorpayOrderId())) {
                throw new BusinessException(ErrorCode.UNAUTHORIZED, "Razorpay payment does not match order");
            }
            if (!fetched.isSuccessful()) {
                throw new BusinessException(ErrorCode.CONFLICT, "Razorpay payment is not captured yet");
            }
        }
        purchase.setGatewayPaymentId(request.getRazorpayPaymentId());
        grantPaid(purchase, null, "Online purchase");
        return toPurchase(purchase);
    }

    @Transactional
    public boolean completeOnlineFromGateway(String gatewayOrderId, String gatewayPaymentId) {
        if (gatewayOrderId == null || gatewayOrderId.isBlank()) {
            return false;
        }
        BuyerMembershipPurchase purchase = purchaseRepository.findByGatewayOrderId(gatewayOrderId).orElse(null);
        if (purchase == null) {
            return false;
        }
        if (purchase.getStatus() == MembershipPurchaseStatus.PAID
                || purchase.getStatus() == MembershipPurchaseStatus.CANCELLED) {
            return true;
        }
        if (gatewayPaymentId != null && !gatewayPaymentId.isBlank()) {
            purchase.setGatewayPaymentId(gatewayPaymentId);
        }
        grantPaid(purchase, null, "Online purchase");
        return true;
    }

    @Transactional
    public MembershipPurchaseResponse cancelCashRequest(UUID actorId, UUID purchaseId) {
        BuyerMembershipPurchase purchase = purchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Purchase not found"));
        if (purchase.getStatus() != MembershipPurchaseStatus.PENDING_CASH) {
            throw new BusinessException(ErrorCode.CONFLICT, "Only a pending cash request can be cancelled");
        }
        purchase.setStatus(MembershipPurchaseStatus.CANCELLED);
        purchase.setConfirmedBy(actorId);
        purchase.setNote("Cash request cancelled");
        return toPurchase(purchase);
    }

    @Transactional
    public ConsumeMembershipResponse consume(ConsumeMembershipRequest request) {
        BigDecimal quoted = request.getQuotedDeliveryFee() == null
                ? BigDecimal.ZERO
                : request.getQuotedDeliveryFee();
        if (quoted.compareTo(BigDecimal.ZERO) <= 0) {
            return ConsumeMembershipResponse.builder()
                    .applied(false)
                    .creditsRemaining(usableCredits(membershipRepository.findByBuyerId(request.getBuyerId()).orElse(null)))
                    .waivedAmount(money(BigDecimal.ZERO))
                    .build();
        }
        if (ledgerRepository.existsByOrderIdAndEntryType(request.getOrderId(), MembershipLedgerType.CONSUME)) {
            BuyerMembership membership = membershipRepository.findByBuyerId(request.getBuyerId()).orElse(null);
            return ConsumeMembershipResponse.builder()
                    .applied(true)
                    .creditsRemaining(usableCredits(membership))
                    .waivedAmount(money(quoted))
                    .build();
        }
        BuyerMembership membership = membershipRepository.lockByBuyerId(request.getBuyerId()).orElse(null);
        if (membership == null || usableCredits(membership) <= 0) {
            return ConsumeMembershipResponse.builder()
                    .applied(false)
                    .creditsRemaining(0)
                    .waivedAmount(money(BigDecimal.ZERO))
                    .build();
        }
        membership.setCreditsRemaining(membership.getCreditsRemaining() - 1);
        ledgerRepository.save(BuyerMembershipLedger.builder()
                .buyerId(request.getBuyerId())
                .membershipId(membership.getId())
                .orderId(request.getOrderId())
                .entryType(MembershipLedgerType.CONSUME)
                .creditsDelta(-1)
                .deliveryFeeWaived(money(quoted))
                .note("Free delivery on order")
                .build());
        return ConsumeMembershipResponse.builder()
                .applied(true)
                .creditsRemaining(usableCredits(membership))
                .waivedAmount(money(quoted))
                .build();
    }

    @Transactional
    public void restore(RestoreMembershipRequest request) {
        if (request.getOrderId() == null) {
            return;
        }
        if (!ledgerRepository.existsByOrderIdAndEntryType(request.getOrderId(), MembershipLedgerType.CONSUME)) {
            return;
        }
        if (ledgerRepository.existsByOrderIdAndEntryType(request.getOrderId(), MembershipLedgerType.RESTORE)) {
            return;
        }
        BuyerMembership membership = membershipRepository.lockByBuyerId(request.getBuyerId()).orElse(null);
        if (membership == null) {
            return;
        }
        membership.setCreditsRemaining(membership.getCreditsRemaining() + 1);
        ledgerRepository.save(BuyerMembershipLedger.builder()
                .buyerId(request.getBuyerId())
                .membershipId(membership.getId())
                .orderId(request.getOrderId())
                .entryType(MembershipLedgerType.RESTORE)
                .creditsDelta(1)
                .note(request.getReason() == null || request.getReason().isBlank()
                        ? "Delivery failed / we cancelled"
                        : request.getReason().trim())
                .build());
    }

    @Transactional(readOnly = true)
    public List<MembershipMemberRow> listMembers() {
        Instant now = Instant.now();
        return membershipRepository.findTop100ByOrderByUpdatedAtDesc().stream()
                .map(m -> MembershipMemberRow.builder()
                        .buyerId(m.getBuyerId())
                        .phone(m.getBuyerPhoneSnapshot())
                        .lastSlab(m.getLastSlab().name())
                        .creditsRemaining(m.getCreditsRemaining())
                        .usableCredits(usableCredits(m, now))
                        .expiresAt(m.getExpiresAt())
                        .active(usableCredits(m, now) > 0)
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MembershipPurchaseResponse> listPurchases() {
        return purchaseRepository.findTop80ByOrderByCreatedAtDesc().stream()
                .map(this::toPurchase)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MembershipPurchaseResponse> listPendingCash() {
        return purchaseRepository.findByStatusOrderByCreatedAtDesc(MembershipPurchaseStatus.PENDING_CASH)
                .stream()
                .map(this::toPurchase)
                .toList();
    }

    @Transactional(readOnly = true)
    public MembershipReportResponse report(LocalDate from, LocalDate to) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo.minusDays(29);
        if (rangeFrom.isAfter(rangeTo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from must be on or before to");
        }
        long days = ChronoUnit.DAYS.between(rangeFrom, rangeTo) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
        Instant start = rangeFrom.atStartOfDay(IST).toInstant();
        Instant end = rangeTo.plusDays(1).atStartOfDay(IST).toInstant();
        Instant now = Instant.now();

        List<BuyerMembershipPurchase> paid = purchaseRepository
                .findByPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtDesc(start, end);
        Map<String, NamedAcc> slabs = new LinkedHashMap<>();
        Map<String, NamedAcc> channels = new LinkedHashMap<>();
        long packsSold = 0;
        long gifts = 0;
        BigDecimal paidRevenue = BigDecimal.ZERO;
        for (BuyerMembershipPurchase p : paid) {
            if (p.getStatus() != MembershipPurchaseStatus.PAID) {
                continue;
            }
            if (p.getPaymentChannel() == MembershipPaymentChannel.ADMIN_GIFT) {
                gifts++;
            } else {
                packsSold++;
                paidRevenue = paidRevenue.add(nz(p.getPriceSnapshot()));
            }
            slabs.computeIfAbsent(p.getSlab().name(), k -> new NamedAcc()).add(1, nz(p.getPriceSnapshot()));
            channels.computeIfAbsent(p.getPaymentChannel().name(), k -> new NamedAcc()).add(1, nz(p.getPriceSnapshot()));
        }

        long consumeCount = ledgerRepository.countEntries(MembershipLedgerType.CONSUME, start, end);
        long restoreCount = ledgerRepository.countEntries(MembershipLedgerType.RESTORE, start, end);
        long creditsGranted = ledgerRepository.sumCredits(MembershipLedgerType.GRANT, start, end);
        BigDecimal waived = ledgerRepository.sumWaived(start, end);

        return MembershipReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .activeMembers(membershipRepository.countActive(now))
                .expiringIn7Days(membershipRepository.countExpiringBetween(now, now.plus(7, ChronoUnit.DAYS)))
                .usableCreditsOutstanding(membershipRepository.sumUsableCredits(now))
                .packsSold(packsSold)
                .gifts(gifts)
                .cashPending(purchaseRepository.findByStatusOrderByCreatedAtDesc(MembershipPurchaseStatus.PENDING_CASH).size())
                .paidRevenue(money(paidRevenue))
                .creditsGranted(Math.max(0, creditsGranted))
                .deliveriesWaived(consumeCount)
                .creditsRestored(restoreCount)
                .deliveryFeeWaived(money(waived))
                .slabMix(toNamed(slabs))
                .channelMix(toNamed(channels))
                .build();
    }

    private void cancelPendingOnline(UUID buyerId) {
        purchaseRepository.findByBuyerIdOrderByCreatedAtDesc(buyerId).stream()
                .filter(p -> p.getStatus() == MembershipPurchaseStatus.PENDING_PAYMENT)
                .forEach(p -> p.setStatus(MembershipPurchaseStatus.CANCELLED));
    }

    private void grantPaid(BuyerMembershipPurchase purchase, UUID confirmedBy, String note) {
        if (purchase.getStatus() == MembershipPurchaseStatus.PAID) {
            return;
        }
        if (purchase.getStatus() == MembershipPurchaseStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "This purchase was cancelled");
        }
        Instant now = Instant.now();
        Instant newExpiry = ZonedDateTime.now(IST).plusMonths(purchase.getDurationMonths()).toInstant();
        BuyerMembership membership = membershipRepository.lockByBuyerId(purchase.getBuyerId())
                .orElseGet(() -> BuyerMembership.builder()
                        .buyerId(purchase.getBuyerId())
                        .buyerPhoneSnapshot(purchase.getBuyerPhoneSnapshot())
                        .lastSlab(purchase.getSlab())
                        .creditsRemaining(0)
                        .creditsGrantedTotal(0)
                        .expiresAt(now)
                        .build());
        if (membership.getId() == null) {
            membershipRepository.saveAndFlush(membership);
        }
        int add = purchase.getCreditsGranted();
        membership.setBuyerPhoneSnapshot(purchase.getBuyerPhoneSnapshot());
        membership.setLastSlab(purchase.getSlab());
        membership.setCreditsRemaining(membership.getCreditsRemaining() + add);
        membership.setCreditsGrantedTotal(membership.getCreditsGrantedTotal() + add);
        membership.setExpiresAt(newExpiry);
        membershipRepository.save(membership);

        purchase.setStatus(MembershipPurchaseStatus.PAID);
        purchase.setPaidAt(now);
        purchase.setConfirmedBy(confirmedBy);
        purchase.setExpiresAtAfter(newExpiry);
        if (note != null && !note.isBlank()) {
            purchase.setNote(note);
        }
        voidOtherPendingCash(purchase.getBuyerId(), purchase.getId());

        ledgerRepository.save(BuyerMembershipLedger.builder()
                .buyerId(purchase.getBuyerId())
                .membershipId(membership.getId())
                .purchaseId(purchase.getId())
                .entryType(MembershipLedgerType.GRANT)
                .creditsDelta(add)
                .note(purchase.getSlab().name() + " pack")
                .build());
    }

    private void assertNoPendingCash(UUID buyerId) {
        purchaseRepository.findFirstByBuyerIdAndStatusOrderByCreatedAtDesc(buyerId, MembershipPurchaseStatus.PENDING_CASH)
                .ifPresent(p -> {
                    throw new BusinessException(ErrorCode.CONFLICT,
                            "A cash request is already waiting at the hub. Ask them to confirm it, or cancel it first.");
                });
    }

    private void voidOtherPendingCash(UUID buyerId, UUID keepId) {
        purchaseRepository.findByStatusOrderByCreatedAtDesc(MembershipPurchaseStatus.PENDING_CASH).stream()
                .filter(p -> p.getBuyerId().equals(buyerId))
                .filter(p -> keepId == null || !p.getId().equals(keepId))
                .forEach(p -> p.setStatus(MembershipPurchaseStatus.CANCELLED));
    }

    private BuyerMembershipPurchase resolvePendingCash(ConfirmMembershipCashRequest request) {
        if (request.getPurchaseId() != null) {
            BuyerMembershipPurchase purchase = purchaseRepository.findById(request.getPurchaseId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Cash request not found"));
            if (purchase.getStatus() != MembershipPurchaseStatus.PENDING_CASH) {
                throw new BusinessException(ErrorCode.CONFLICT, "This request is no longer waiting for cash");
            }
            return purchase;
        }
        String phone = normalizePhone(request.getPhone());
        if (phone.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Phone or purchase id is required");
        }
        UserClient.UserProfile user = userClient.findByPhone(phone);
        return purchaseRepository
                .findFirstByBuyerIdAndStatusOrderByCreatedAtDesc(user.id(), MembershipPurchaseStatus.PENDING_CASH)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "No pending cash membership for this phone"));
    }

    private TownClient.Slab requireSellableSlab(TownClient.MembershipConfig config, MembershipSlab slab) {
        TownClient.Slab offer = config.slab(slab.name());
        if (offer == null || offer.credits() <= 0 || offer.price() == null || offer.price().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "This pack is not priced yet. Super Admin must set price and free deliveries.");
        }
        return offer;
    }

    private SlabOffer offer(TownClient.Slab slab, String label, boolean canPurchase) {
        boolean priced = slab != null && slab.credits() > 0 && slab.price() != null && slab.price().compareTo(BigDecimal.ZERO) > 0;
        return SlabOffer.builder()
                .code(slab == null ? "" : slab.code())
                .label(label)
                .months(slab == null ? 0 : slab.months())
                .price(money(slab == null ? BigDecimal.ZERO : slab.price()))
                .credits(slab == null ? 0 : slab.credits())
                .purchasable(canPurchase && priced)
                .build();
    }

    private MembershipMeResponse emptyMine() {
        return MembershipMeResponse.builder()
                .active(false)
                .creditsRemaining(0)
                .usableCredits(0)
                .recentPurchases(List.of())
                .build();
    }

    private MembershipPurchaseResponse toPurchase(BuyerMembershipPurchase p) {
        return MembershipPurchaseResponse.builder()
                .purchaseId(p.getId())
                .buyerId(p.getBuyerId())
                .buyerPhone(p.getBuyerPhoneSnapshot())
                .slab(p.getSlab().name())
                .months(p.getDurationMonths())
                .creditsGranted(p.getCreditsGranted())
                .price(money(p.getPriceSnapshot()))
                .channel(p.getPaymentChannel().name())
                .status(p.getStatus().name())
                .paidAt(p.getPaidAt())
                .expiresAtAfter(p.getExpiresAtAfter())
                .createdAt(p.getCreatedAt())
                .note(p.getNote())
                .checkout(checkoutFor(p))
                .build();
    }

    private GatewayCheckoutResponse checkoutFor(BuyerMembershipPurchase purchase) {
        if (purchase.getStatus() != MembershipPurchaseStatus.PENDING_PAYMENT
                || purchase.getGatewayOrderId() == null
                || !paymentProperties.isRazorpayConfigured()) {
            return null;
        }
        return GatewayCheckoutResponse.builder()
                .keyId(paymentProperties.getRazorpayKeyId())
                .gatewayOrderId(purchase.getGatewayOrderId())
                .amountPaise(RazorpayMoney.toPaise(purchase.getPriceSnapshot()))
                .currency("INR")
                .name(paymentProperties.getCheckoutName())
                .description("Membership " + purchase.getSlab().name())
                .prefillContact(purchase.getBuyerPhoneSnapshot())
                .logoUrl(paymentProperties.getCheckoutLogoUrl() == null || paymentProperties.getCheckoutLogoUrl().isBlank()
                        ? null : paymentProperties.getCheckoutLogoUrl())
                .build();
    }

    private static int usableCredits(BuyerMembership membership) {
        return usableCredits(membership, Instant.now());
    }

    private static int usableCredits(BuyerMembership membership, Instant now) {
        if (membership == null || membership.getExpiresAt() == null || !membership.getExpiresAt().isAfter(now)) {
            return 0;
        }
        return Math.max(0, membership.getCreditsRemaining());
    }

    private static MembershipSlab parseSlab(String raw) {
        try {
            return MembershipSlab.valueOf(raw == null ? "" : raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose 3 months, 6 months, or annual");
        }
    }

    private static MembershipPaymentChannel parseChannel(String raw) {
        try {
            return MembershipPaymentChannel.valueOf(raw == null ? "" : raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Pay online or cash");
        }
    }

    private static String normalizePhone(String phone) {
        return phone == null ? "" : phone.trim().replaceAll("\\s+", "");
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal money(BigDecimal v) {
        return nz(v).setScale(2, RoundingMode.HALF_UP);
    }

    private static List<NamedCount> toNamed(Map<String, NamedAcc> map) {
        List<NamedCount> rows = new ArrayList<>();
        map.forEach((name, acc) -> rows.add(NamedCount.builder()
                .name(name)
                .count(acc.count)
                .amount(money(acc.amount))
                .build()));
        rows.sort(Comparator.comparing(NamedCount::getAmount).reversed());
        return rows;
    }

    private static class NamedAcc {
        long count;
        BigDecimal amount = BigDecimal.ZERO;

        void add(long n, BigDecimal money) {
            count += n;
            amount = amount.add(nz(money));
        }
    }
}
