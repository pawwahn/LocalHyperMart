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
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);

    private final OrderClient orderClient;
    private final SettlementService settlementService;
    private final DeliverySettlementService deliverySettlementService;
    private final VendorClient vendorClient;
    private final DeliveryClient deliveryClient;
    private final TownClient townClient;
    private final CodCloseDayLineItemRepository closeLineRepository;
    private final ExecutorService workers = Executors.newFixedThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "open-accounts");
        thread.setDaemon(true);
        return thread;
    });

    public List<Line> scan(LocalDate from, LocalDate to) {
        LocalDate start = from == null ? OPEN_START : from;
        LocalDate end = to == null ? LocalDate.now(IST) : to;
        if (end.isBefore(start)) {
            LocalDate swap = start;
            start = end;
            end = swap;
        }
        orderClient.beginReplay();
        deliveryClient.beginReplay();
        townClient.beginReplay();
        List<Line> out = new ArrayList<>();
        try {
            scanVendors(out, from, to, start, end);
            scanHubsAndAgents(out, start, end);
        } finally {
            orderClient.endReplay();
            deliveryClient.endReplay();
            townClient.endReplay();
        }
        return out;
    }

    private void scanVendors(List<Line> out, LocalDate requestedFrom, LocalDate requestedTo, LocalDate start, LocalDate end) {
        List<OrderClient.BagKey> keys = null;
        try {
            keys = orderClient.settlementBagKeys(start, end);
        } catch (RuntimeException ex) {
            log.warn("Could not list delivered bag keys: {}", ex.toString());
        }
        if (keys == null) {
            scanVendorsOneByOne(out, requestedFrom, requestedTo, start, end);
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
            List<Line> out, LocalDate requestedFrom, LocalDate requestedTo, LocalDate start, LocalDate end) {
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
            BigDecimal fee = money(quote.totalFeeAmount());
            if (fee.signum() > 0) {
                String extra = "commission " + inr(fee);
                if (quote.appliedSlabLabel() != null && !quote.appliedSlabLabel().isBlank()) {
                    extra = extra + " · " + quote.appliedSlabLabel().trim();
                }
                extra = extra + " · " + cashNote(collect);
                out.add(line(townId, "VENDOR", vendorId, shop, "SEND_BILL",
                        "Shop holds the cash — bill the commission",
                        bagsDetail(collect, extra),
                        periodStart(collect, start), periodEnd(collect, end),
                        fee, collect.size(), firstOrder(collect), fee));
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
                        net, pay.size(), firstOrder(pay), commission));
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
                    money(bill.getAmount()), 1, null, null));
        }
    }

    private void scanHubsAndAgents(List<Line> out, LocalDate start, LocalDate end) {
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
        try {
            String name = vendorClient.getVendorShopDisplayName(vendorId);
            return name == null || name.isBlank() ? "Vendor" : name;
        } catch (RuntimeException ex) {
            return "Vendor";
        }
    }

    private String hubName(UUID hubId) {
        try {
            String name = deliveryClient.getHubDisplayName(hubId);
            return name == null || name.isBlank() ? "Hub" : name;
        } catch (RuntimeException ex) {
            return "Hub";
        }
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
                    item.getSubtotal() == null ? BigDecimal.ZERO : item.getSubtotal(), when));
        }
        return lines;
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
        return new Line(townId, party, partyId, partyName, action, what, detail,
                periodStart, periodEnd, amount, itemCount, reference, commission);
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
            BigDecimal commission) {
    }
}
