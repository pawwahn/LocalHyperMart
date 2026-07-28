package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class VendorListingResponse {

    private UUID listingId;
    private UUID masterItemId;
    private String name;
    private String unit;
    private UUID townId;
    private UUID vendorId;
    private UUID shopId;
    private String shopName;
    private BigDecimal masterMrp;
    private BigDecimal vendorMrp;
    private BigDecimal mrp;
    private BigDecimal price;
    private BigDecimal discountPrice;
    private BigDecimal specialDiscountPrice;
    private Instant specialDiscountValidFrom;
    private Instant specialDiscountValidTo;
    private boolean specialDiscountActive;
    private BigDecimal effectivePrice;
    private String vendorNote;
    private boolean active;
    /** Effective images shown to buyers (listing override or master fallback). */
    private List<String> imageUrls;
    /** Vendor-uploaded overrides only; empty means using master catalog photos. */
    private List<String> listingImageUrls;
    /** Admin master-item defaults. */
    private List<String> masterImageUrls;
    private boolean customImages;
}
