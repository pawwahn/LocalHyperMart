package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class HubOrderStatsResponse {

    long readyForPickupCount;
    long placedOrdersCount;
}
