package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.ScratchCardStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class ScratchCardResponse {

    private UUID id;
    private UUID orderId;
    private String orderNumber;
    private ScratchCardStatus status;
    private BigDecimal rewardMin;
    private BigDecimal rewardMax;
    private BigDecimal revealedAmount;
}
