package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.client.VendorClient;
import com.hyperlocalmart.payment.dto.response.DeliverySettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SubscriptionBillView;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Work that is owed but not yet a bill or payout: shop-held fee bills, unpaid shop goods,
 * unsent subscriptions, and hub or agent delivery fees.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OpenAccountsService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final LocalDate OPEN_START = LocalDate.of(2020, 1, 1);
    /** When no from-date is set, only scan this many days of deliveries — open settlements still come from DB. */
    private static final int UNBOUNDED_SCAN_DAYS = 120;
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);

    private final OrderClient orderClient;
    private final SettlementService settlementService;
    private final DeliverySettlementService deliverySettlementService;
    private final VendorClient vendorClient;
    private final DeliveryClient deliveryClient;
    private final TownClient townClient;
    private final CodCloseDayLineItemRepository closeLineRepository;
    private final HubCodCustodyService hubCodCustodyService;
    private final ExecutorService workers = Executors.newFixedThreadPool(
            Math.min(16, Math.max(4, Runtime.getRuntime().availableProcessors())),
            runnable -> {
                Thread thread = new Thread(runnable, "open-accounts");
                thread.setDaemon(true);
                return thread;
            });

    private final Map<UUID, String> vendorNameCache = new HashMap<>();
    private final Map<UUID, String> hubNameCache = new HashMap<>();

    public List<Line> scan(LocalDate from, LocalDate to) {
        return scan(from, to, null);
    }

    public List<Line> scan(LocalDate from, LocalDate to, UUID townId) {
        LocalDate end = to == null ? LocalDate.now(IST) : to;
        LocalDate start = from == null ? end.minusDays(UNBOUNDED_SCAN_DAYS) : from;
        if (start.isBefore(OPEN_START)) {
            start = OPEN_START;
        }
        if (end.isBefore(start)) {
            LocalDate swap = start;
            start = end;
            end = swap;
        }
        vendorNameCache.clear();
        hubNameCache.clear();
        orderClient.beginReplay();
        deliveryClient.beginReplay();
        townClient.beginReplay();
        List<Line> out = new ArrayList<>();
        try {
            scanVendors(out, from, to, start, end, townId);
            scanHubsAndAgents(out, start, end, townId);
            scanDeliveredCodAccounts(out, start, end, townId);
        } finally {
            orderClient.endReplay();
            deliveryClient.endReplay();
            townClient.endReplay();
        }
        return out;
    }

    private void scanVendors(
            List<Line> out,
            LocalDate requestedFrom,
            LocalDate requestedTo,
            LocalDate start,
            LocalDate end,
            UUID townFilter) {
        List<OrderClient.BagKey> keys = null;
        try {
            keys = orderClient.settlementBagKeys(start, end);
        } catch (RuntimeException ex) {
            log.warn("Could not list delivered bag keys: {}", ex.toString());
        }
        if (keys == null) {
            scanVendorsOneByOne(out, requestedFrom, requestedTo, start, end, townFilter);
            return;
        }
        Map<String, UUID> vendorByPair = new LinkedHashMap<>();
        Map<String, UUID> townByPair = new LinkedHashMap<>();
        Map<String, List<UUID>> idsByPair = new HashMap<>();
        List<UUID> allIds = new ArrayList<>();
        for (OrderClient.BagKey key : keys) {
            if (key == null || key.vendorId() == null || key.townId() == null || key.subOrderId() == null) {
                continue;
            }
            if (townFilter != null && !townFilter.equals(key.townId())) {
                continue;
            }
            String pair = key.vendorId() + "|" + key.townId();
            vendorByPair.putIfAbsent(pair, key.vendorId());
            townByPair.putIfAbsent(pair, key.townId());
            idsByPair.computeIfAbsent(pair, ignored -> new ArrayList<>()).add(key.subOrderId());
            allIds.add(key.subOrderId());
        }
        Set<UUID> settledIds;
        try {
            settledIds = settlementService.settledSubOrderIds(allIds);
        } catch (RuntimeException ex) {
            log.warn("Could not list settled bags, so every shop is checked: {}", ex.toString());
            settledIds = Set.of();
        }
        Set<UUID> settled = settledIds;
        Map<UUID, UUID> townForVendor = new LinkedHashMap<>();
        List<Callable<List<Line>>> jobs = new ArrayList<>();
        for (Map.Entry<String, UUID> pair : vendorByPair.entrySet()) {
            UUID vendorId = pair.getValue();
            UUID townId = townByPair.get(pair.getKey());
            townForVendor.putIfAbsent(vendorId, townId);
            boolean open = idsByPair.getOrDefault(pair.getKey(), List.of()).stream().anyMatch(id -> !settled.contains(id));
            if (!open) {
                continue;
            }
            jobs.add(() -> {
                List<Line> local = new ArrayList<>();
                try {
                    appendVendor(local, townId, vendorId, start, end);
                } catch (RuntimeException ex) {
                    log.warn("Skipped open shop work for {}: {}", vendorId, ex.toString());
                }
                return local;
            });
        }
        for (Map.Entry<UUID, UUID> vendor : townForVendor.entrySet()) {
            jobs.add(() -> {
                List<Line> local = new ArrayList<>();
                try {
                    appendUnsentSubscription(local, vendor.getValue(), vendor.getKey(), requestedFrom, requestedTo);
                } catch (RuntimeException ex) {
                    log.warn("Skipped subscription scan for {}: {}", vendor.getKey(), ex.toString());
                }
                return local;
            });
        }
        out.addAll(runJobs(jobs));
    }

    /** Used when bag keys are not available. One shop at a time. */
    private void scanVendorsOneByOne(
            List<Line> out,
            LocalDate requestedFrom,
            LocalDate requestedTo,
            LocalDate start,
            LocalDate end,
            UUID townFilter) {
        List<OrderClient.VendorTown> pairs;
        try {
            pairs = orderClient.deliveredVendorTowns(start, end);
        } catch (RuntimeException ex) {
            log.warn("Could not list shops with delivered bags: {}", ex.toString());
            return;
        }
        Set<UUID> subscriptionsDone = new HashSet<>();
        for (OrderClient.VendorTown pair : pairs) {
            if (pair == null || pair.vendorId() == null || pair.townId() == null) {
                continue;
            }
            if (townFilter != null && !townFilter.equals(pair.townId())) {
                continue;
            }
            try {
                appendVendor(out, pair.townId(), pair.vendorId(), start, end);
            } catch (RuntimeException ex) {
                log.warn("Skipped open shop work for {}: {}", pair.vendorId(), ex.toString());
            }
            if (subscriptionsDone.add(pair.vendorId())) {
                try {
                    appendUnsentSubscription(out, pair.townId(), pair.vendorId(), requestedFrom, requestedTo);
                } catch (RuntimeException ex) {
                    log.warn("Skipped subscription scan for {}: {}", pair.vendorId(), ex.toString());
                }
            }
        }
    }

    private List<Line> runJobs(List<Callable<List<Line>>> jobs) {
        if (jobs.isEmpty()) {
            return List.of();
        }
        try {
            List<Line> lines = new ArrayList<>();
            for (Future<List<Line>> future : workers.invokeAll(jobs)) {
                try {
                    lines.addAll(future.get());
                } catch (ExecutionException ex) {
                    log.warn("Open accounts job failed: {}", ex.getCause() == null ? ex.toString() : ex.getCause().toString());
                }
            }
            return lines;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("Open accounts scan interrupted");
            return List.of();
        }
    }

    private void appendVendor(List<Line> out, UUID townId, UUID vendorId, LocalDate start, LocalDate end) {
        SettlementCandidateView view = settlementService.listCandidates(townId, vendorId, start, end);
        List<SettlementCandidateView.Item> items = view.getItems() == null ? List.of() : view.getItems();
        List<SettlementCandidateView.Item> open = items.stream().filter(item -> !item.isAlreadySettled()).toList();
        if (open.isEmpty()) {
            return;
        }
        List<SettlementCandidateView.Item> collect = open.stream()
                .filter(item -> SettlementService.vendorHoldsBuyerCash(
                        item.isVendorAgentDelivery(), item.getPaymentMethod(), item.getCodCashLocation()))
                .toList();
        List<SettlementCandidateView.Item> pay = open.stream()
                .filter(item -> !SettlementService.vendorHoldsBuyerCash(
                        item.isVendorAgentDelivery(), item.getPaymentMethod(), item.getCodCashLocation()))
                .toList();
        String shop = shopName(vendorId);
        if (!collect.isEmpty()) {
            VendorClient.CommercialTermsQuote quote = vendorClient.quoteCommercialTerms(
                    vendorId, start, end, orderLines(collect), false, true);
            BigDecimal commissionOnly = money(quote.totalFeeAmount());
            BigDecimal platform = platformFees(collect);
            BigDecimal cod = codFees(collect);
            BigDecimal membership = membershipFees(collect);
            BigDecimal fee = commissionOnly.add(platform).add(cod).add(membership);
            if (fee.signum() > 0) {
                String extra = "";
                if (quote.appliedSlabLabel() != null && !quote.appliedSlabLabel().isBlank()) {
                    extra = quote.appliedSlabLabel().trim();
                }
                if (!extra.isBlank()) {
                    extra = extra + " · ";
                }
                extra = extra + cashNote(collect);
                out.add(line(townId, "VENDOR", vendorId, shop, "SEND_BILL",
                        "Shop holds the cash — bill commission + platform fee",
                        bagsDetail(collect, extra),
                        periodStart(collect, start), periodEnd(collect, end),
                        fee, collect.size(), firstOrder(collect), commissionOnly,
                        feePart(platform), feePart(cod), feePart(membership), null));
            }
        }
        if (!pay.isEmpty()) {
            VendorClient.CommercialTermsQuote quote = vendorClient.quoteCommercialTerms(
                    vendorId, start, end, orderLines(pay), false, false);
            BigDecimal claims = money(view.getPendingClaimChargebacks());
            BigDecimal commission = money(quote.totalFeeAmount());
            BigDecimal net = money(quote.suggestedNet()).subtract(claims);
            if (net.signum() < 0) {
                net = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            }
            if (net.signum() > 0) {
                String extra = "commission " + inr(commission);
                if (claims.signum() > 0) {
                    extra = extra + " · claim deduction " + inr(claims);
                }
                extra = extra + " · pay " + inr(net);
                out.add(line(townId, "VENDOR", vendorId, shop, "PAY",
                        "Pay the shop — commission already taken off",
                        bagsDetail(pay, extra),
                        periodStart(pay, start), periodEnd(pay, end),
                        net, pay.size(), firstOrder(pay), commission, null, null, null, null));
            }
        }
    }

    private void appendUnsentSubscription(
            List<Line> out, UUID townId, UUID vendorId, LocalDate from, LocalDate to) {
        String shop = shopName(vendorId);
        for (SubscriptionBillView bill : settlementService.listSubscriptionBills(vendorId)) {
            if (bill == null || !"NOT_SENT".equals(bill.getStatus()) || bill.getAmount() == null
                    || bill.getAmount().signum() <= 0) {
                continue;
            }
            if (from != null && bill.getPeriodEnd() != null && bill.getPeriodEnd().isBefore(from)) {
                continue;
            }
            if (to != null && bill.getPeriodStart() != null && bill.getPeriodStart().isAfter(to)) {
                continue;
            }
            String month = bill.getPeriodStart() == null
                    ? bill.getMonth()
                    : YearMonth.from(bill.getPeriodStart()).format(MONTH);
            out.add(line(townId, "VENDOR", vendorId, shop, "SEND_BILL",
                    "Monthly subscription — send the bill",
                    month + " · not billed yet · not commission",
                    bill.getPeriodStart(), bill.getPeriodEnd(),
                    money(bill.getAmount()), 1, null, null, null, null, null, null));
        }
    }

    private void scanHubsAndAgents(List<Line> out, LocalDate start, LocalDate end, UUID townFilter) {
        List<Object[]> hubs;
        try {
            hubs = closeLineRepository.distinctHubTowns();
        } catch (RuntimeException ex) {
            log.warn("Could not list hubs for open payouts: {}", ex.toString());
            return;
        }
        Set<String> agentsDone = new HashSet<>();
        for (Object[] row : hubs) {
            if (row == null || row.length < 2) {
                continue;
            }
            UUID townId = uuid(row[0]);
            UUID hubId = uuid(row[1]);
            if (townId == null || hubId == null) {
                continue;
            }
            if (townFilter != null && !townFilter.equals(townId)) {
                continue;
            }
            try {
                appendDeliveryPayee(out, townId, SettlementPayeeType.HUB, hubId, hubName(hubId), start, end);
            } catch (RuntimeException ex) {
                log.warn("Skipped open hub payout for {}: {}", hubId, ex.toString());
            }
            List<DeliveryClient.AgentSummary> agents = List.of();
            try {
                agents = deliveryClient.listHubAgents(hubId);
            } catch (RuntimeException ex) {
                log.warn("Could not list agents for hub {}: {}", hubId, ex.toString());
            }
            for (DeliveryClient.AgentSummary agent : agents) {
                if (agent == null || agent.agentId() == null) {
                    continue;
                }
                if (!agentsDone.add(townId + "|" + agent.agentId())) {
                    continue;
                }
                try {
                    appendDeliveryPayee(out, townId, SettlementPayeeType.AGENT, agent.agentId(),
                            agentName(agent), start, end);
                } catch (RuntimeException ex) {
                    log.warn("Skipped open agent payout for {}: {}", agent.agentId(), ex.toString());
                }
            }
        }
    }

    /**
     * Delivered COD that is not yet on a vendor settlement or hub remittance — independent of agent handover.
     */
    private void scanDeliveredCodAccounts(List<Line> out, LocalDate start, LocalDate end, UUID townFilter) {
        Set<UUID> townIds = new LinkedHashSet<>();
        if (townFilter != null) {
            townIds.add(townFilter);
        } else {
            try {
                for (OrderClient.VendorTown pair : orderClient.deliveredVendorTowns(start, end)) {
                    if (pair != null && pair.townId() != null) {
                        townIds.add(pair.townId());
                    }
                }
            } catch (RuntimeException ex) {
                log.warn("Could not list towns for delivered COD accounts: {}", ex.toString());
            }
            try {
                for (Object[] row : closeLineRepository.distinctHubTowns()) {
                    UUID townId = uuid(row[0]);
                    if (townId != null) {
                        townIds.add(townId);
                    }
                }
            } catch (RuntimeException ex) {
                log.warn("Could not list hub towns for delivered COD accounts: {}", ex.toString());
            }
        }
        if (townIds.isEmpty()) {
            return;
        }

        Set<UUID> deliveredBagSubOrders = deliveredBagSubOrderIds(start, end, townFilter);
        Map<String, VendorCodGap> vendorGaps = new LinkedHashMap<>();
        Map<String, HubCodGap> hubGaps = new LinkedHashMap<>();

        for (UUID townId : townIds) {
            OrderClient.CodDeliveredOrders delivered;
            try {
                delivered = orderClient.getCodDeliveredRange(townId, null, start, end, null);
            } catch (RuntimeException ex) {
                log.warn("Skipped delivered COD scan for town {}: {}", townId, ex.toString());
                continue;
            }
            List<OrderClient.CodDeliveredItem> items =
                    delivered.items() == null ? List.of() : delivered.items();
            if (items.isEmpty()) {
                continue;
            }
            List<UUID> orderIds = items.stream()
                    .map(OrderClient.CodDeliveredItem::orderId)
                    .filter(Objects::nonNull)
                    .toList();
            if (orderIds.isEmpty()) {
                continue;
            }
            Set<UUID> onCloseDay = new HashSet<>(closeLineRepository.findClosedOrderIds(orderIds));
            Set<UUID> withCompany = hubCodCustodyService.ordersAlreadyWithCompany(orderIds);
            List<OrderClient.CodCashBreakdown> breakdowns;
            try {
                breakdowns = orderClient.codCashBreakdown(orderIds);
            } catch (RuntimeException ex) {
                log.warn("Skipped COD breakdown for town {}: {}", townId, ex.toString());
                continue;
            }
            List<UUID> subOrderIds = breakdowns.stream()
                    .flatMap(b -> b.vendorAllocations() == null ? java.util.stream.Stream.empty()
                            : b.vendorAllocations().stream())
                    .map(OrderClient.VendorAllocation::subOrderId)
                    .filter(Objects::nonNull)
                    .toList();
            Set<UUID> settledSubOrders;
            try {
                settledSubOrders = settlementService.settledSubOrderIds(subOrderIds);
            } catch (RuntimeException ex) {
                settledSubOrders = Set.of();
            }

            for (OrderClient.CodCashBreakdown breakdown : breakdowns) {
                UUID orderId = breakdown.orderId();
                if (orderId == null || onCloseDay.contains(orderId) || withCompany.contains(orderId)) {
                    continue;
                }
                if ("HUB".equalsIgnoreCase(breakdown.custodianType())) {
                    UUID hubId = breakdown.hubId();
                    if (hubId == null || breakdown.collectAmount() == null
                            || breakdown.collectAmount().signum() <= 0) {
                        continue;
                    }
                    String key = townId + "|" + hubId;
                    hubGaps.computeIfAbsent(key, ignored -> new HubCodGap(townId, hubId))
                            .add(breakdown);
                    continue;
                }
                if (!"VENDOR".equalsIgnoreCase(breakdown.custodianType())) {
                    continue;
                }
                List<OrderClient.VendorAllocation> gapAllocations = gapAllocations(
                        breakdown, deliveredBagSubOrders, settledSubOrders);
                if (gapAllocations.isEmpty()) {
                    continue;
                }
                for (OrderClient.VendorAllocation allocation : gapAllocations) {
                    if (allocation.vendorId() == null) {
                        continue;
                    }
                    String key = townId + "|" + allocation.vendorId();
                    vendorGaps.computeIfAbsent(key, ignored -> new VendorCodGap(townId, allocation.vendorId()))
                            .add(breakdown, allocation);
                }
            }
        }

        for (VendorCodGap gap : vendorGaps.values()) {
            appendVendorCodGap(out, gap, start, end);
        }
        for (HubCodGap gap : hubGaps.values()) {
            appendHubCodGap(out, gap, start, end);
        }
    }

    private Set<UUID> deliveredBagSubOrderIds(LocalDate start, LocalDate end, UUID townFilter) {
        Set<UUID> ids = new HashSet<>();
        try {
            List<OrderClient.BagKey> keys = orderClient.settlementBagKeys(start, end);
            if (keys == null) {
                return ids;
            }
            for (OrderClient.BagKey key : keys) {
                if (key != null && key.subOrderId() != null) {
                    if (townFilter != null && key.townId() != null && !townFilter.equals(key.townId())) {
                        continue;
                    }
                    ids.add(key.subOrderId());
                }
            }
        } catch (RuntimeException ex) {
            log.warn("Could not list delivered bag keys for COD accounts: {}", ex.toString());
        }
        return ids;
    }

    private static List<OrderClient.VendorAllocation> gapAllocations(
            OrderClient.CodCashBreakdown breakdown,
            Set<UUID> deliveredBagSubOrders,
            Set<UUID> settledSubOrders) {
        if (breakdown.vendorAllocations() == null || breakdown.vendorAllocations().isEmpty()) {
            return List.of();
        }
        List<OrderClient.VendorAllocation> out = new ArrayList<>();
        for (OrderClient.VendorAllocation allocation : breakdown.vendorAllocations()) {
            UUID subOrderId = allocation.subOrderId();
            if (subOrderId != null && settledSubOrders.contains(subOrderId)) {
                continue;
            }
            if (subOrderId != null && deliveredBagSubOrders.contains(subOrderId)) {
                continue;
            }
            out.add(allocation);
        }
        return out;
    }

    private void appendVendorCodGap(List<Line> out, VendorCodGap gap, LocalDate start, LocalDate end) {
        List<VendorClient.OrderLine> quoteLines = new ArrayList<>();
        BigDecimal feeShare = BigDecimal.ZERO;
        BigDecimal membership = BigDecimal.ZERO;
        Set<UUID> membershipOrders = new HashSet<>();
        List<String> orderNumbers = new ArrayList<>();
        for (VendorCodGap.OrderSlice slice : gap.slices()) {
            Instant when = slice.breakdown().deliveredAt() != null
                    ? slice.breakdown().deliveredAt()
                    : Instant.now();
            quoteLines.add(new VendorClient.OrderLine(
                    money(slice.allocation().goodsSubtotal()), when, null));
            feeShare = feeShare.add(money(slice.allocation().allocatedCash())
                    .subtract(money(slice.allocation().goodsSubtotal())).max(BigDecimal.ZERO));
            UUID orderId = slice.breakdown().orderId();
            if (orderId != null && membershipOrders.add(orderId)) {
                BigDecimal allocated = slice.breakdown().vendorAllocations() == null
                        ? BigDecimal.ZERO
                        : slice.breakdown().vendorAllocations().stream()
                        .map(OrderClient.VendorAllocation::allocatedCash)
                        .map(OpenAccountsService::money)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                membership = membership.add(
                        money(slice.breakdown().collectAmount()).subtract(allocated).max(BigDecimal.ZERO));
            }
            if (slice.breakdown().orderNumber() != null && !slice.breakdown().orderNumber().isBlank()) {
                orderNumbers.add(slice.breakdown().orderNumber().trim());
            }
        }
        VendorClient.CommercialTermsQuote quote;
        try {
            quote = vendorClient.quoteCommercialTerms(
                    gap.vendorId(), start, end, quoteLines, false, true);
        } catch (RuntimeException ex) {
            log.warn("Skipped COD gap quote for vendor {}: {}", gap.vendorId(), ex.toString());
            return;
        }
        BigDecimal commission = money(quote.totalFeeAmount());
        BigDecimal amount = commission.add(feeShare).add(membership);
        if (amount.signum() <= 0) {
            return;
        }
        String shop = shopName(gap.vendorId());
        String orders = orderNumbers.stream().distinct().limit(3).reduce((a, b) -> a + ", " + b).orElse("");
        long extra = orderNumbers.stream().distinct().count() - Math.min(3, orderNumbers.size());
        if (extra > 0) {
            orders = orders + " +" + extra;
        }
        String detail = gap.slices().size() + " delivered COD order"
                + (gap.slices().size() == 1 ? "" : "s")
                + " · commission " + inr(commission);
        if (feeShare.signum() > 0) {
            detail = detail + " · fees " + inr(feeShare);
        }
        if (membership.signum() > 0) {
            detail = detail + " · membership " + inr(membership);
        }
        if (!orders.isBlank()) {
            detail = detail + " · " + orders;
        }
        LocalDate periodFrom = gap.slices().stream()
                .map(s -> istDay(s.breakdown().deliveredAt()))
                .filter(Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElse(start);
        LocalDate periodTo = gap.slices().stream()
                .map(s -> istDay(s.breakdown().deliveredAt()))
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(end);
        out.add(line(gap.townId(), "VENDOR", gap.vendorId(), shop, "SEND_BILL",
                "Delivered COD — platform fees (not on settlement yet)",
                detail, periodFrom, periodTo, amount, gap.slices().size(),
                gap.slices().size() == 1 ? orderNumbers.get(0) : null, commission,
                feePart(feeShare.max(BigDecimal.ZERO)), null, feePart(membership), null));
    }

    private void appendHubCodGap(List<Line> out, HubCodGap gap, LocalDate start, LocalDate end) {
        BigDecimal amount = gap.breakdowns().stream()
                .map(OrderClient.CodCashBreakdown::collectAmount)
                .map(OpenAccountsService::money)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (amount.signum() <= 0) {
            return;
        }
        String name = hubName(gap.hubId());
        List<String> orderNumbers = gap.breakdowns().stream()
                .map(OrderClient.CodCashBreakdown::orderNumber)
                .filter(n -> n != null && !n.isBlank())
                .distinct()
                .limit(3)
                .toList();
        long extra = gap.breakdowns().stream()
                .map(OrderClient.CodCashBreakdown::orderNumber)
                .filter(n -> n != null && !n.isBlank())
                .distinct()
                .count() - orderNumbers.size();
        String orders = String.join(", ", orderNumbers);
        if (extra > 0) {
            orders = orders + " +" + extra;
        }
        String detail = gap.breakdowns().size() + " delivered COD order"
                + (gap.breakdowns().size() == 1 ? "" : "s")
                + " · buyer cash " + inr(amount);
        if (!orders.isBlank()) {
            detail = detail + " · " + orders;
        }
        LocalDate periodFrom = gap.breakdowns().stream()
                .map(b -> istDay(b.deliveredAt()))
                .filter(Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElse(start);
        LocalDate periodTo = gap.breakdowns().stream()
                .map(b -> istDay(b.deliveredAt()))
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(end);
        out.add(line(gap.townId(), "HUB", gap.hubId(), name, "SEND_BILL",
                "Delivered hub-route COD — not remitted to platform yet",
                detail, periodFrom, periodTo, amount, gap.breakdowns().size(),
                gap.breakdowns().size() == 1 && !orderNumbers.isEmpty() ? orderNumbers.get(0) : null, null));
    }

    private static final class VendorCodGap {
        private final UUID townId;
        private final UUID vendorId;
        private final List<OrderSlice> slices = new ArrayList<>();

        VendorCodGap(UUID townId, UUID vendorId) {
            this.townId = townId;
            this.vendorId = vendorId;
        }

        void add(OrderClient.CodCashBreakdown breakdown, OrderClient.VendorAllocation allocation) {
            slices.add(new OrderSlice(breakdown, allocation));
        }

        UUID townId() {
            return townId;
        }

        UUID vendorId() {
            return vendorId;
        }

        List<OrderSlice> slices() {
            return slices;
        }

        record OrderSlice(OrderClient.CodCashBreakdown breakdown, OrderClient.VendorAllocation allocation) {}
    }

    private static final class HubCodGap {
        private final UUID townId;
        private final UUID hubId;
        private final List<OrderClient.CodCashBreakdown> breakdowns = new ArrayList<>();

        HubCodGap(UUID townId, UUID hubId) {
            this.townId = townId;
            this.hubId = hubId;
        }

        void add(OrderClient.CodCashBreakdown breakdown) {
            breakdowns.add(breakdown);
        }

        UUID townId() {
            return townId;
        }

        UUID hubId() {
            return hubId;
        }

        List<OrderClient.CodCashBreakdown> breakdowns() {
            return breakdowns;
        }
    }

    private void appendDeliveryPayee(
            List<Line> out,
            UUID townId,
            SettlementPayeeType payeeType,
            UUID payeeId,
            String name,
            LocalDate start,
            LocalDate end) {
        DeliverySettlementCandidateView view =
                deliverySettlementService.listCandidates(townId, payeeType, payeeId, start, end);
        List<DeliverySettlementCandidateView.Item> open = view.getItems() == null
                ? List.of()
                : view.getItems().stream()
                .filter(item -> !item.isAlreadySettled())
                .filter(item -> item.getSkipReason() == null || item.getSkipReason().isBlank())
                .filter(item -> item.getAmount() != null && item.getAmount().signum() > 0)
                .toList();
        if (open.isEmpty()) {
            return;
        }
        BigDecimal amount = open.stream().map(DeliverySettlementCandidateView.Item::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        amount = money(amount);
        if (amount.signum() <= 0) {
            return;
        }
        boolean hub = payeeType == SettlementPayeeType.HUB;
        String orders = deliveryOrders(open);
        String bags = open.size() == 1 ? "1 order" : open.size() + " orders";
        String detail = bags + " · delivery fee " + inr(amount);
        if (!orders.isBlank()) {
            detail = detail + " · " + orders;
        }
        LocalDate periodFrom = open.stream().map(item -> istDay(item.getDeliveredAt())).filter(d -> d != null)
                .min(LocalDate::compareTo).orElse(start);
        LocalDate periodTo = open.stream().map(item -> istDay(item.getDeliveredAt())).filter(d -> d != null)
                .max(LocalDate::compareTo).orElse(end);
        out.add(line(townId, hub ? "HUB" : "AGENT", payeeId, name, "PAY",
                hub ? "Hub delivery fees not paid yet" : "Delivery agent fees not paid yet",
                detail, periodFrom, periodTo, amount, open.size(),
                open.size() == 1 ? open.get(0).getOrderNumber() : null, null));
    }

    private String shopName(UUID vendorId) {
        if (vendorId == null) {
            return "Vendor";
        }
        String cached = vendorNameCache.get(vendorId);
        if (cached != null) {
            return cached;
        }
        try {
            String name = vendorClient.getVendorShopDisplayName(vendorId);
            cached = name == null || name.isBlank() ? "Vendor" : name;
        } catch (RuntimeException ex) {
            cached = "Vendor";
        }
        vendorNameCache.put(vendorId, cached);
        return cached;
    }

    private String hubName(UUID hubId) {
        if (hubId == null) {
            return "Hub";
        }
        String cached = hubNameCache.get(hubId);
        if (cached != null) {
            return cached;
        }
        try {
            String name = deliveryClient.getHubDisplayName(hubId);
            cached = name == null || name.isBlank() ? "Hub" : name;
        } catch (RuntimeException ex) {
            cached = "Hub";
        }
        hubNameCache.put(hubId, cached);
        return cached;
    }

    private static String agentName(DeliveryClient.AgentSummary agent) {
        if (agent.name() != null && !agent.name().isBlank()) {
            return agent.name().trim();
        }
        return "Delivery agent";
    }

    private static List<VendorClient.OrderLine> orderLines(List<SettlementCandidateView.Item> items) {
        List<VendorClient.OrderLine> lines = new ArrayList<>();
        for (SettlementCandidateView.Item item : items) {
            Instant when = item.getPlacedAt() != null ? item.getPlacedAt() : item.getDeliveredAt();
            if (when == null) {
                when = Instant.now();
            }
            lines.add(new VendorClient.OrderLine(
                    item.getSubtotal() == null ? BigDecimal.ZERO : item.getSubtotal(), when, item.getPieceCount()));
        }
        return lines;
    }

    private static BigDecimal platformFees(List<SettlementCandidateView.Item> items) {
        return items.stream()
                .map(item -> money(item.getPlatformFee()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal codFees(List<SettlementCandidateView.Item> items) {
        return items.stream()
                .map(item -> money(item.getCodFee()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal membershipFees(List<SettlementCandidateView.Item> items) {
        return items.stream()
                .map(item -> money(item.getMembershipFee()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String cashNote(List<SettlementCandidateView.Item> items) {
        boolean declared = items.stream().anyMatch(item -> "DECLARED_TO_VENDOR".equals(item.getCodCashLocation()));
        boolean confirmed = items.stream().anyMatch(item -> "WITH_VENDOR".equals(item.getCodCashLocation()));
        if (confirmed && declared) {
            return "cash with shop";
        }
        if (declared) {
            return "cash declared to shop";
        }
        if (confirmed) {
            return "cash with shop";
        }
        return "shop holds buyer cash";
    }

    private static String bagsDetail(List<SettlementCandidateView.Item> items, String extra) {
        BigDecimal gross = items.stream()
                .map(item -> item.getSubtotal() == null ? BigDecimal.ZERO : item.getSubtotal())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String bags = items.size() == 1 ? "1 bag" : items.size() + " bags";
        StringBuilder text = new StringBuilder(bags).append(" · goods ").append(inr(gross));
        if (extra != null && !extra.isBlank()) {
            text.append(" · ").append(extra);
        }
        String orders = orderNumbers(items);
        if (!orders.isBlank()) {
            text.append(" · ").append(orders);
        }
        return text.toString();
    }

    private static String orderNumbers(List<SettlementCandidateView.Item> items) {
        List<String> numbers = items.stream()
                .map(SettlementCandidateView.Item::getOrderNumber)
                .filter(number -> number != null && !number.isBlank())
                .distinct()
                .limit(3)
                .toList();
        long extra = items.stream()
                .map(SettlementCandidateView.Item::getOrderNumber)
                .filter(number -> number != null && !number.isBlank())
                .distinct()
                .count() - numbers.size();
        String joined = String.join(", ", numbers);
        if (extra > 0) {
            joined = joined + " +" + extra;
        }
        return joined;
    }

    private static String deliveryOrders(List<DeliverySettlementCandidateView.Item> items) {
        List<String> numbers = items.stream()
                .map(DeliverySettlementCandidateView.Item::getOrderNumber)
                .filter(number -> number != null && !number.isBlank())
                .distinct()
                .limit(3)
                .toList();
        long extra = items.stream()
                .map(DeliverySettlementCandidateView.Item::getOrderNumber)
                .filter(number -> number != null && !number.isBlank())
                .distinct()
                .count() - numbers.size();
        String joined = String.join(", ", numbers);
        if (extra > 0) {
            joined = joined + " +" + extra;
        }
        return joined;
    }

    private static String firstOrder(List<SettlementCandidateView.Item> items) {
        if (items.size() != 1) {
            return null;
        }
        String number = items.get(0).getOrderNumber();
        return number == null || number.isBlank() ? null : number;
    }

    private static LocalDate periodStart(List<SettlementCandidateView.Item> items, LocalDate fallback) {
        return items.stream()
                .map(item -> istDay(item.getDeliveredAt() != null ? item.getDeliveredAt() : item.getPlacedAt()))
                .filter(day -> day != null)
                .min(LocalDate::compareTo)
                .orElse(fallback);
    }

    private static LocalDate periodEnd(List<SettlementCandidateView.Item> items, LocalDate fallback) {
        return items.stream()
                .map(item -> istDay(item.getDeliveredAt() != null ? item.getDeliveredAt() : item.getPlacedAt()))
                .filter(day -> day != null)
                .max(LocalDate::compareTo)
                .orElse(fallback);
    }

    private static LocalDate istDay(Instant instant) {
        return instant == null ? null : instant.atZone(IST).toLocalDate();
    }

    private static BigDecimal money(BigDecimal raw) {
        if (raw == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private static String inr(BigDecimal amount) {
        return "₹" + money(amount).toPlainString();
    }

    private static UUID uuid(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof UUID id) {
            return id;
        }
        String text = raw.toString().trim();
        if (text.isEmpty()) {
            return null;
        }
        return UUID.fromString(text);
    }

    private static BigDecimal feePart(BigDecimal value) {
        if (value == null || value.signum() <= 0) {
            return null;
        }
        return money(value);
    }

    private static Line line(
            UUID townId,
            String party,
            UUID partyId,
            String partyName,
            String action,
            String what,
            String detail,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal amount,
            int itemCount,
            String reference,
            BigDecimal commission) {
        return line(townId, party, partyId, partyName, action, what, detail, periodStart, periodEnd, amount,
                itemCount, reference, commission, null, null, null, null);
    }

    private static Line line(
            UUID townId,
            String party,
            UUID partyId,
            String partyName,
            String action,
            String what,
            String detail,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal amount,
            int itemCount,
            String reference,
            BigDecimal commission,
            BigDecimal platformFee,
            BigDecimal codFee,
            BigDecimal membershipFee,
            BigDecimal penalty) {
        return new Line(townId, party, partyId, partyName, action, what, detail,
                periodStart, periodEnd, amount, itemCount, reference, commission,
                platformFee, codFee, membershipFee, penalty);
    }

    public record Line(
            UUID townId,
            String party,
            UUID partyId,
            String partyName,
            String action,
            String what,
            String detail,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal amount,
            int itemCount,
            String reference,
            BigDecimal commission,
            BigDecimal platformFee,
            BigDecimal codFee,
            BigDecimal membershipFee,
            BigDecimal penalty) {
    }
}
