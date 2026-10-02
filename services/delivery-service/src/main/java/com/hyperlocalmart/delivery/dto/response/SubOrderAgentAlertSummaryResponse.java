package com.hyperlocalmart.delivery.dto.response;

import com.hyperlocalmart.delivery.entity.DeliveryAgentAlertStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class SubOrderAgentAlertSummaryResponse {

    private UUID vendorSubOrderId;
    private UUID alertId;
    private DeliveryAgentAlertStatus status;
    private Instant acknowledgedAt;
}
