package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.dto.request.CreateCodHubPlatformRemittanceRequest;
import com.hyperlocalmart.payment.dto.response.CodHubLedgerResponse;
import com.hyperlocalmart.payment.entity.CodCloseDay;
import com.hyperlocalmart.payment.entity.CodCustodianType;
import com.hyperlocalmart.payment.entity.CodHubPlatformRemittance;
import com.hyperlocalmart.payment.repository.CodCloseDayRepository;
import com.hyperlocalmart.payment.repository.CodHubPlatformRemittanceRepository;
import com.hyperlocalmart.payment.repository.HubPlatformPaymentSubmissionRepository;
import com.hyperlocalmart.payment.entity.HubPlatformPaymentSubmissionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CodHubLedgerService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final CodCloseDayRepository codCloseDayRepository;
    private final CodHubPlatformRemittanceRepository remittanceRepository;
    private final HubPlatformPaymentSubmissionRepository hubPaymentSubmissionRepository;
    private final DeliveryClient deliveryClient;

    @Transactional(readOnly = true)
    public CodHubLedgerResponse ledger(
            UUID townId, UUID hubId, LocalDate from, LocalDate to, UUID actorUserId, boolean superAdmin) {
        assertHubScope(actorUserId, townId, hubId, superAdmin);
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : LocalDate.of(2020, 1, 1);
        if (rangeTo.isBefore(rangeFrom)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "to must be on or after from");
        }

        BigDecimal receivedAllTime = scale(codCloseDayRepository.sumReceivedByTownHubAndCustodian(
                townId, hubId, CodCustodianType.HUB));
        BigDecimal remittedAllTime = scale(remittanceRepository.sumAmountByTownAndHub(townId, hubId));
        BigDecimal balance = receivedAllTime.subtract(remittedAllTime).setScale(2, RoundingMode.HALF_UP);

        BigDecimal receivedInRange = scale(codCloseDayRepository.sumReceivedByTownHubCustodianAndDateRange(
                townId, hubId, CodCustodianType.HUB, rangeFrom, rangeTo));
        BigDecimal remittedInRange = scale(remittanceRepository.sumAmountByTownHubAndDateRange(
                townId, hubId, rangeFrom, rangeTo));

        Map<UUID, String> agentNames = agentNameMap(hubId);
        List<CodCloseDay> closes = codCloseDayRepository.findByTownHubCustodianAndDateRange(
                townId, hubId, CodCustodianType.HUB, rangeFrom, rangeTo);

        List<CodHubLedgerResponse.ReceiptRow> receipts = closes.stream()
                .map(c -> CodHubLedgerResponse.ReceiptRow.builder()
                        .closeDayId(c.getId())
                        .agentId(c.getAgentId())
                        .agentName(agentNames.getOrDefault(c.getAgentId(), "Delivery agent"))
                        .closeDate(c.getCloseDate().toString())
                        .receivedAmount(scale(c.getReceivedAmount()))
                        .orderCount(c.getOrderCount())
                        .status(c.getStatus().name())
                        .confirmedAt(c.getCreatedAt())
                        .fromAgentHandover(c.getAgentHandoverId() != null)
                        .build())
                .toList();

        List<CodHubPlatformRemittance> remittanceRows =
                remittanceRepository.findByTownIdAndHubIdAndRemittanceDateBetweenOrderByRemittanceDateDescCreatedAtDesc(
                        townId, hubId, rangeFrom, rangeTo);
        List<CodHubLedgerResponse.RemittanceRow> remittances = remittanceRows.stream()
                .map(this::toRemittanceRow)
                .toList();

        return CodHubLedgerResponse.builder()
                .townId(townId)
                .hubId(hubId)
                .from(rangeFrom.toString())
                .to(rangeTo.toString())
                .totalReceivedAllTime(receivedAllTime)
                .totalRemittedAllTime(remittedAllTime)
                .balanceOwedToCompany(balance)
                .totalReceivedInRange(receivedInRange)
                .totalRemittedInRange(remittedInRange)
                .receipts(receipts)
                .remittances(remittances)
                .build();
    }

    @Transactional
    public CodHubLedgerResponse.RemittanceRow recordRemittance(
            CreateCodHubPlatformRemittanceRequest request, UUID actorUserId) {
        if (hubPaymentSubmissionRepository.existsByHubIdAndStatus(
                request.getHubId(), HubPlatformPaymentSubmissionStatus.PENDING_VERIFICATION)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Hub has an online payment awaiting verification — confirm or reject it first to avoid double counting.");
        }
        LocalDate date = request.getRemittanceDate() != null
                ? request.getRemittanceDate()
                : LocalDate.now(IST);
        BigDecimal amount = request.getAmount().setScale(2, RoundingMode.HALF_UP);

        CodHubPlatformRemittance row = CodHubPlatformRemittance.builder()
                .townId(request.getTownId())
                .hubId(request.getHubId())
                .remittanceDate(date)
                .amount(amount)
                .reference(trimToNull(request.getReference()))
                .notes(trimToNull(request.getNotes()))
                .build();
        row.setCreatedBy(actorUserId);
        row.setUpdatedBy(actorUserId);
        row = remittanceRepository.save(row);
        return toRemittanceRow(row);
    }

    @Transactional
    public CodHubPlatformRemittance saveVerifiedRemittance(CodHubPlatformRemittance row) {
        if (row.getAmount() == null || row.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Remittance amount must be more than ₹0");
        }
        row.setAmount(row.getAmount().setScale(2, RoundingMode.HALF_UP));
        return remittanceRepository.save(row);
    }

    private CodHubLedgerResponse.RemittanceRow toRemittanceRow(CodHubPlatformRemittance row) {
        return CodHubLedgerResponse.RemittanceRow.builder()
                .remittanceId(row.getId())
                .remittanceDate(row.getRemittanceDate().toString())
                .amount(scale(row.getAmount()))
                .reference(row.getReference())
                .notes(row.getNotes())
                .recordedAt(row.getCreatedAt())
                .build();
    }

    private Map<UUID, String> agentNameMap(UUID hubId) {
        Map<UUID, String> map = new HashMap<>();
        for (DeliveryClient.AgentSummary agent : deliveryClient.listHubAgents(hubId)) {
            if (agent.agentId() != null && agent.name() != null) {
                map.put(agent.agentId(), agent.name());
            }
        }
        return map;
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
}
