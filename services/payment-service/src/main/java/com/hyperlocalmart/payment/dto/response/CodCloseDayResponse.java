package com.hyperlocalmart.payment.dto.response;

import com.hyperlocalmart.payment.entity.CodCloseDayStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CodCloseDayResponse {
    UUID id;
    UUID townId;
    UUID hubId;
    UUID agentId;
    LocalDate closeDate;
    BigDecimal expectedAmount;
    BigDecimal receivedAmount;
    int orderCount;
    CodCloseDayStatus status;
    String notes;
    Instant createdAt;
    List<Line> lines;

    @Value
    @Builder
    public static class Line {
        UUID id;
        UUID orderId;
        String orderNumber;
        BigDecimal amount;
    }
}
