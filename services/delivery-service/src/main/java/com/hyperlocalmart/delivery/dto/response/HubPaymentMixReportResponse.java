package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class HubPaymentMixReportResponse {

    private UUID hubId;
    private UUID townId;
    private LocalDate from;
    private LocalDate to;
    private long deliveredOrders;
    private long codDeliveredOrders;
    private long onlineDeliveredOrders;
    private BigDecimal deliveredGmv;
    private BigDecimal codDeliveredGmv;
    private BigDecimal onlineDeliveredGmv;
}
