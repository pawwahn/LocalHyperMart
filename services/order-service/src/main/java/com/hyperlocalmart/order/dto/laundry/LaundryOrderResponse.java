package com.hyperlocalmart.order.dto.laundry;

import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class LaundryOrderResponse {

    private UUID id;
    private String orderNumber;
    private UUID townId;
    private UUID vendorId;
    private String shopName;
    private UUID buyerId;
    private String logistics;
    private String status;
    private String statusLabel;
    private String paymentMethod;
    private String paymentStatus;
    private BigDecimal goodsAmount;
    private BigDecimal logisticsCharge;
    private BigDecimal amountCollected;
    private BigDecimal platformFeeAmount;
    private BigDecimal codFee;
    private String platformFeeModel;
    private int pieceCount;
    private String specialInstructions;
    private String addressText;
    private String contactName;
    private String contactPhone;
    private Instant requestedPickupStart;
    private Instant requestedPickupEnd;
    private Instant pickupSlotStart;
    private Instant pickupSlotEnd;
    private Instant estimatedReadyAt;
    private String buyerComment;
    private String vendorComment;
    private BigDecimal walletCredited;
    private int pickupRescheduleCount;
    private boolean rewashUsed;
    private boolean complaintOpen;
    private Instant placedAt;
    private Instant deliveredAt;
    private String slaMessage;
    /** Present when UPI checkout has just been started. */
    private PaymentInfoResponse payment;

    @Builder.Default
    private List<String> allowedActions = new ArrayList<>();

    @Builder.Default
    private List<LineResponse> lines = new ArrayList<>();

    @Data
    @Builder
    public static class LineResponse {
        private UUID id;
        private String serviceType;
        private String itemType;
        private String otherLabel;
        private int quantity;
        private int confirmedQuantity;
        private BigDecimal unitPrice;
        private BigDecimal lineAmount;
        private String conditionNote;
        private UUID photoMediaId;
        private String photoUrl;
        private boolean photoDeleted;
    }
}
