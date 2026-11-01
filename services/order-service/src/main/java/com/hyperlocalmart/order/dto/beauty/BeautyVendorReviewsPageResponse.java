package com.hyperlocalmart.order.dto.beauty;

import com.hyperlocalmart.common.api.PageResponse;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BeautyVendorReviewsPageResponse {

    private BeautyVendorReviewsSummary summary;

    @Builder.Default
    private PageResponse<BeautyCustomerReview> reviews = PageResponse.<BeautyCustomerReview>builder().build();
}
