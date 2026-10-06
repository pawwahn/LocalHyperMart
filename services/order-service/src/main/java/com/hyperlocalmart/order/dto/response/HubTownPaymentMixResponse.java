package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class HubTownPaymentMixResponse {

    private LocalDate from;
    private LocalDate to;
    private long deliveredOrders;
    private long codDeliveredOrders;
    private long onlineDeliveredOrders;
    private BigDecimal deliveredGmv;
    private BigDecimal codDeliveredGmv;
    private BigDecimal onlineDeliveredGmv;
}
