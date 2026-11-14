package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class UpsertFoodProfileRequest {

    private Boolean enabled;

    @Size(max = 200)
    private String tagline;

    @Size(max = 300)
    private String cuisines;

    private Boolean pureVeg;

    @Size(max = 40)
    private String opensAtLabel;

    @DecimalMin("0.0")
    private BigDecimal priceForOne;

    @Size(max = 80)
    private String offerLabel;

    private Boolean acceptingOrders;

    /** Optional — replaces hotel gallery when sent (max 8 media ids). */
    private List<UUID> hotelPhotoMediaIds;
}