package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.OrderClient.CodDeliveredItem;
import com.hyperlocalmart.payment.dto.request.CreateCodCloseDayRequest;
import com.hyperlocalmart.payment.dto.response.CodCandidateResponse;
import com.hyperlocalmart.payment.dto.response.CodCloseDayResponse;
import com.hyperlocalmart.payment.dto.response.CodSummaryResponse;
import com.hyperlocalmart.payment.entity.CodCloseDay;
import com.hyperlocalmart.payment.entity.CodCloseDayLineItem;
import com.hyperlocalmart.payment.entity.CodCloseDayStatus;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import com.hyperlocalmart.payment.repository.CodCloseDayRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CodCloseDayService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal MATCH_TOLERANCE = new BigDecimal("0.01");

    private final CodCloseDayRepository codCloseDayRepository;
    private final CodCloseDayLineItemRepository codCloseDayLineItemRepository;
    private final OrderClient orderClient;
    private final DeliveryClient deliveryClient;

    @Transactional(readOnly = true)
    public CodCandidateResponse listCandidates(
            UUID townId, UUID hubId, UUID agentId, LocalDate date, UUID actorUserId, boolean superAdmin) {
        assertHubScope(actorUserId, townId, hubId, superAdmin);
        var delivered = orderClient.getCodDelivered(townId, agentId, date);
        List<CodDeliveredItem> items = delivered.items() == null ? List.of() : delivered.items();
        List<UUID> ids = items.stream().map(CodDeliveredItem::orderId).toList();
        Set<UUID> closed = ids.isEmpty() ? Set.of()
                : new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(ids));

        List<CodCandidateResponse.Item> mapped = items.stream()
                .map(item -> CodCandidateResponse.Item.builder()
                        .orderId(item.orderId())
                        .orderNumber(item.orderNumber())
                        .amount(item.totalAmount())
                        .deliveredAt(item.deliveredAt())
                        .alreadyClosed(closed.contains(item.orderId()))
                        .build())
                .toList();

        return CodCandidateResponse.builder()
                .townId(townId)
                .hubId(hubId)
                .agentId(agentId)
                .date(date.toString())
                .agentFilterApplied(delivered.agentFilterApplied())
                .items(mapped)
                .build();
    }

    @Transactional
    public CodCloseDayResponse closeDay(
            CreateCodCloseDayRequest request, UUID actorUserId, boolean superAdmin) {
        assertHubScope(actorUserId, request.getTownId(), request.getHubId(), superAdmin);
        if (request.getPin() == null || request.getPin().isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "pin is required");
        }
        deliveryClient.verifyHubPin(actorUserId, request.getPin());
        if (request.getReceivedAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "receivedAmount must be >= 0");
        }

        LocalDate closeDate = request.getCloseDate() != null
                ? request.getCloseDate()
                : LocalDate.now(IST);

        List<UUID> orderIds = request.getOrderIds().stream().filter(Objects::nonNull).distinct().toList();
        if (orderIds.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "orderIds must not be empty");
        }

        Set<UUID> alreadyClosed = new HashSet<>(codCloseDayLineItemRepository.findClosedOrderIds(orderIds));
        if (!alreadyClosed.isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Some orders are already included in a COD close-day: " + alreadyClosed.size());
        }

        List<CodDeliveredItem> resolved = orderClient.resolveCodDelivered(orderIds);
        if (resolved.size() != orderIds.size()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "One or more orders are not COD DELIVERED");
        }

        Map<UUID, CodDeliveredItem> byId = resolved.stream()
                .collect(Collectors.toMap(CodDeliveredItem::orderId, i -> i, (a, b) -> a));

        BigDecimal expected = orderIds.stream()
                .map(byId::get)
                .map(CodDeliveredItem::totalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal received = request.getReceivedAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal diff = expected.subtract(received).abs();
        CodCloseDayStatus status = diff.compareTo(MATCH_TOLERANCE) < 0
                ? CodCloseDayStatus.MATCHED
                : CodCloseDayStatus.DISCREPANCY;

        CodCloseDay closeDay = CodCloseDay.builder()
                .townId(request.getTownId())
                .hubId(request.getHubId())
                .agentId(request.getAgentId())
                .closeDate(closeDate)
                .expectedAmount(expected)
                .receivedAmount(received)
                .orderCount(orderIds.size())
                .status(status)
                .notes(request.getNotes())
                .build();
        closeDay.setCreatedBy(actorUserId);
        closeDay.setUpdatedBy(actorUserId);

        for (UUID orderId : orderIds) {
            CodDeliveredItem item = byId.get(orderId);
            CodCloseDayLineItem line = CodCloseDayLineItem.builder()
                    .closeDay(closeDay)
                    .orderId(item.orderId())
                    .orderNumber(item.orderNumber())
                    .amount(item.totalAmount())
                    .build();
            line.setCreatedBy(actorUserId);
            line.setUpdatedBy(actorUserId);
            closeDay.getLineItems().add(line);
        }

        return toResponse(codCloseDayRepository.save(closeDay));
    }

    @Transactional(readOnly = true)
    public CodSummaryResponse summary(
            UUID townId, UUID hubId, LocalDate date, UUID actorUserId, boolean superAdmin) {
        assertHubScope(actorUserId, townId, hubId, superAdmin);
        List<CodCloseDay> closes = codCloseDayRepository.findByTownHubAndDate(townId, hubId, date);
        BigDecimal expected = BigDecimal.ZERO;
        BigDecimal received = BigDecimal.ZERO;
        int orderCount = 0;
        int matched = 0;
        int discrepancy = 0;
        for (CodCloseDay c : closes) {
            expected = expected.add(nullSafe(c.getExpectedAmount()));
            received = received.add(nullSafe(c.getReceivedAmount()));
            orderCount += c.getOrderCount();
            if (c.getStatus() == CodCloseDayStatus.MATCHED) {
                matched++;
            } else if (c.getStatus() == CodCloseDayStatus.DISCREPANCY) {
                discrepancy++;
            }
        }
        return CodSummaryResponse.builder()
                .townId(townId)
                .hubId(hubId)
                .date(date.toString())
                .closeCount(closes.size())
                .orderCount(orderCount)
                .expectedAmount(expected)
                .receivedAmount(received)
                .matchedCount(matched)
                .discrepancyCount(discrepancy)
                .build();
    }

    @Transactional(readOnly = true)
    public List<CodCloseDayResponse> listCloses(
            UUID townId, UUID hubId, LocalDate from, LocalDate to, UUID actorUserId, boolean superAdmin) {
        assertHubScope(actorUserId, townId, hubId, superAdmin);
        if (to.isBefore(from)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "to must be on or after from");
        }
        return codCloseDayRepository.findByTownHubAndDateRange(townId, hubId, from, to).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Hub admins may only touch their own hub/town. Super admins may pass any scope.
     */
    private void assertHubScope(UUID actorUserId, UUID townId, UUID hubId, boolean superAdmin) {
        if (superAdmin) {
            return;
        }
        DeliveryClient.HubAdminContext ctx = deliveryClient.getHubAdminContext(actorUserId);
        if (!ctx.hubId().equals(hubId) || !ctx.townId().equals(townId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub/town does not match your assignment");
        }
    }

    private CodCloseDayResponse toResponse(CodCloseDay closeDay) {
        List<CodCloseDayResponse.Line> lines = closeDay.getLineItems() == null ? List.of()
                : closeDay.getLineItems().stream()
                .sorted(Comparator.comparing(CodCloseDayLineItem::getOrderNumber,
                        Comparator.nullsLast(String::compareTo)))
                .map(line -> CodCloseDayResponse.Line.builder()
                        .id(line.getId())
                        .orderId(line.getOrderId())
                        .orderNumber(line.getOrderNumber())
                        .amount(line.getAmount())
                        .build())
                .toList();

        return CodCloseDayResponse.builder()
                .id(closeDay.getId())
                .townId(closeDay.getTownId())
                .hubId(closeDay.getHubId())
                .agentId(closeDay.getAgentId())
                .closeDate(closeDay.getCloseDate())
                .expectedAmount(closeDay.getExpectedAmount())
                .receivedAmount(closeDay.getReceivedAmount())
                .orderCount(closeDay.getOrderCount())
                .status(closeDay.getStatus())
                .notes(closeDay.getNotes())
                .createdAt(closeDay.getCreatedAt())
                .lines(lines)
                .build();
    }

    private static BigDecimal nullSafe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
