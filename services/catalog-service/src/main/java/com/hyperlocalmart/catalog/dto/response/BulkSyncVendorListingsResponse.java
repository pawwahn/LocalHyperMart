package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class BulkSyncVendorListingsResponse {

    private int created;
    private int updated;
    private int hidden;
    private int failed;
    private List<RowError> errors;

    @Data
    @Builder
    public static class RowError {
        private UUID masterItemId;
        private String productName;
        private String message;
    }
}
