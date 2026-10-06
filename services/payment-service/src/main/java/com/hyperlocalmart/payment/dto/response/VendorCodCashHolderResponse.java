package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class VendorCodCashHolderResponse {
    List<Item> items;

    @Value
    @Builder
    public static class Item {
        UUID subOrderId;
        UUID orderId;
        String paymentMethod;
        boolean vendorAgentDelivery;
        /** ONLINE | WITH_AGENT | AT_HUB | WITH_VENDOR | DECLARED_TO_VENDOR | DECLARED_TO_HUB */
        String codCashLocation;
        /** PLATFORM | VENDOR | VENDOR_AGENT | HUB_ADMIN | HUB_AGENT */
        String holderRole;
        String holderLabel;
        String holderDetail;
        UUID agentId;
        String agentName;
        String agentPhone;
        UUID hubId;
        String hubName;
    }
}
