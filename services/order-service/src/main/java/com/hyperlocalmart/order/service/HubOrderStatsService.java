package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.HubOrderStatsResponse;
import com.hyperlocalmart.order.dto.response.HubTownReportStatsResponse;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HubOrderStatsService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 90;

    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public HubOrderStatsResponse getHubOrderStats(UUID townId) {
        return HubOrderStatsResponse.builder()
                .readyForPickupCount(vendorSubOrderRepository.countReadyForPickupByTownId(townId))
                .placedOrdersCount(orderRepository.countByTownIdAndStatus(townId, OrderStatus.PLACED))
                .build();
    }

    @Transactional(readOnly = true)
    public HubTownReportStatsResponse getTownReportStats(UUID townId, LocalDate from, LocalDate to) {
        validateDateRange(from, to);
        var start = from.atStartOfDay(IST).toInstant();
        var end = to.plusDays(1).atStartOfDay(IST).toInstant();
        return HubTownReportStatsResponse.builder()
                .from(from)
                .to(to)
                .ordersPlaced(orderRepository.countPlacedByTownIdAndPlacedAtBetween(townId, start, end))
                .ordersDelivered(orderRepository.countDeliveredByTownIdAndDeliveredAtBetween(townId, start, end))
                .ordersCancelled(orderRepository.countCancelledByTownIdAndCancelledAtBetween(townId, start, end))
                .subOrdersPlaced(vendorSubOrderRepository.countByTownIdAndPlacedAtBetween(townId, start, end))
                .bagsMarkedReady(vendorSubOrderRepository.countMarkedReadyByTownIdAndReadyAtBetween(townId, start, end))
                .build();
    }

    private void validateDateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' and 'to' are required");
        }
        if (from.isAfter(to)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' must be on or before 'to'");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
    }
}
