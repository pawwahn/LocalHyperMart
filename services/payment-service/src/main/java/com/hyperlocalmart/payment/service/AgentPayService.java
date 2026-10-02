package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.dto.response.AgentPaySummaryResponse;
import com.hyperlocalmart.payment.dto.response.DeliverySettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentPayService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int UNPAID_CAP = 40;

    private final DeliveryClient deliveryClient;
    private final TownClient townClient;
    private final DeliverySettlementService deliverySettlementService;
    private final SettlementService settlementService;

    public AgentPaySummaryResponse summary(UUID agentUserId, LocalDate from, LocalDate to) {
        DeliveryClient.AgentContext agent = deliveryClient.getAgentByUserId(agentUserId);
        LocalDate today = LocalDate.now(IST);
        LocalDate start = from != null ? from : today.withDayOfMonth(1);
        LocalDate end = to != null ? to : today;
        if (end.isBefore(start)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid date range");
        }

        TownClient.DeliveryPayoutConfig.Party party = null;
        try {
            TownClient.DeliveryPayoutConfig cfg = townClient.deliveryPayoutConfig(agent.townId());
            party = cfg == null ? null : cfg.agent();
        } catch (RuntimeException ignored) {
            // Rates stay zero if town config is down; job amounts still come from candidates.
        }

        boolean vendorShopAgent = agent.agentType() != null
                && "VENDOR".equalsIgnoreCase(agent.agentType());
        TownClient.VendorAgentDeliveryConfig vendorAgentCfg = null;
        if (vendorShopAgent) {
            try {
                vendorAgentCfg = townClient.vendorAgentDeliveryConfig(agent.townId());
            } catch (RuntimeException ignored) {
            }
        }
        boolean hubPayEnabled = party != null && party.enabled()
                && party.perOrder() != null && party.perOrder().enabled();
        boolean vendorPayEnabled = vendorShopAgent
                && vendorAgentCfg != null
                && vendorAgentCfg.enabled();
        boolean payEnabled = vendorPayEnabled || hubPayEnabled;
        String payModel = vendorShopAgent ? "VENDOR_SHOP" : "HUB_NETWORK";
        BigDecimal pickupRate = money(party == null || party.perOrder() == null ? null : party.perOrder().pickupAmount());
        BigDecimal lastMileRate = money(party == null || party.perOrder() == null ? null : party.perOrder().lastMileAmount());
        BigDecimal completedRate = money(
                party == null || party.perOrder() == null ? null : party.perOrder().completedOrderAmount());
        BigDecimal vendorDirectOrderRate = money(
                vendorAgentCfg == null ? null : vendorAgentCfg.vendorAgentPayoutAmount());

        DeliverySettlementCandidateView candidates = deliverySettlementService.listCandidates(
                agent.townId(), SettlementPayeeType.AGENT, agent.agentId(), start, end);

        BigDecimal earned = BigDecimal.ZERO;
        BigDecimal paid = BigDecimal.ZERO;
        long payable = 0;
        long settled = 0;
        long yourDeliveries = 0;
        List<AgentPaySummaryResponse.UnpaidOrder> unpaid = new java.util.ArrayList<>();
        for (DeliverySettlementCandidateView.Item item : candidates.getItems()) {
            if (countsAsYourDelivery(item.getSkipReason())) {
                yourDeliveries++;
            }
            if (item.getSkipReason() != null) {
                continue;
            }
            payable++;
            BigDecimal amount = money(item.getAmount());
            earned = earned.add(amount);
            if (item.isAlreadySettled()) {
                settled++;
                paid = paid.add(amount);
            } else if (unpaid.size() < UNPAID_CAP) {
                unpaid.add(AgentPaySummaryResponse.UnpaidOrder.builder()
                        .orderId(item.getOrderId())
                        .orderNumber(item.getOrderNumber())
                        .deliveredAt(item.getDeliveredAt())
                        .amount(amount)
                        .pickupCompleted(item.isPickupCompleted())
                        .lastMileCompleted(item.isLastMileCompleted())
                        .build());
            }
        }

        List<AgentPaySummaryResponse.Payout> payouts = settlementService
                .list(agent.townId(), SettlementPayeeType.AGENT, agent.agentId(), null)
                .stream()
                .filter(row -> overlaps(row, start, end))
                .sorted(Comparator.comparing(SettlementResponse::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toPayout)
                .toList();

        BigDecimal due = earned.subtract(paid).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

        return AgentPaySummaryResponse.builder()
                .agentId(agent.agentId())
                .agentName(agent.name())
                .townId(agent.townId())
                .from(start.toString())
                .to(end.toString())
                .payEnabled(payEnabled)
                .payModel(payModel)
                .pickupRate(pickupRate)
                .lastMileRate(lastMileRate)
                .completedOrderRate(completedRate)
                .vendorDirectOrderRate(vendorDirectOrderRate)
                .payableOrders(payable)
                .yourDeliveries(yourDeliveries)
                .unpaidOrderCount(payable - settled)
                .earned(earned.setScale(2, RoundingMode.HALF_UP))
                .paid(paid.setScale(2, RoundingMode.HALF_UP))
                .due(due)
                .unpaidOrders(unpaid)
                .payouts(payouts)
                .build();
    }

    private AgentPaySummaryResponse.Payout toPayout(SettlementResponse row) {
        int orderCount = 0;
        if (row.getLines() != null) {
            orderCount = (int) row.getLines().stream()
                    .filter(line -> line.getOrderId() != null)
                    .count();
        }
        return AgentPaySummaryResponse.Payout.builder()
                .settlementId(row.getId())
                .status(row.getStatus() == null ? "" : row.getStatus().name())
                .periodStart(row.getPeriodStart() == null ? null : row.getPeriodStart().toString())
                .periodEnd(row.getPeriodEnd() == null ? null : row.getPeriodEnd().toString())
                .netAmount(money(row.getNetAmount()))
                .payoutMethod(row.getPayoutMethod())
                .transactionReference(row.getTransactionReference())
                .paidAt(row.getPaidAt())
                .orderCount(orderCount)
                .build();
    }

    private static boolean overlaps(SettlementResponse row, LocalDate from, LocalDate to) {
        LocalDate start = row.getPeriodStart();
        LocalDate end = row.getPeriodEnd();
        if (start == null || end == null) {
            return true;
        }
        return !end.isBefore(from) && !start.isAfter(to);
    }

    private static boolean countsAsYourDelivery(String skipReason) {
        if (skipReason == null) {
            return true;
        }
        return "Shop delivery pay is not enabled for this town".equals(skipReason)
                || "Pay is ₹0".equals(skipReason);
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
}
