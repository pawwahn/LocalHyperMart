package com.hyperlocalmart.order.dto.diagnostics;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class DiagnosticsActionRequest {

    private String action;
    private String note;
    private UUID assignedStaffId;
    private String assignedStaffName;
    private UUID receivedByStaffId;
    private String receivedByStaffName;
    private Instant reportEta;
    private UUID mediaId;
    /** INTERIM or FINAL when uploading a lab report file attachment. */
    private String reportKind;
    private BigDecimal codAmountCollected;
    private List<LineResult> lineResults = new ArrayList<>();

    @Data
    public static class LineResult {
        private UUID lineId;
        private String resultValue;
        private String resultUnit;
        private String referenceRange;
        private String resultFlag;
    }
}
