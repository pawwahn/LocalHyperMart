package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class DeliveryAgentRatingListResponse {

    private double averageStars;
    private long ratingCount;
    /** Current platform flag — hub admins only receive a list when this is true. */
    private boolean visibleToHub;
    private List<DeliveryAgentRatingAdminItem> items;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}
