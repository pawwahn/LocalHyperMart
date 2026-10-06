package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class HubCodPaymentPreviewResponse {

    private UUID townId;
    private UUID hubId;
    private String periodKind;
    private String periodStart;
    private String periodEnd;
    private BigDecimal totalAmount;
    private BigDecimal hubBalanceOwedToCompany;
    private int orderCount;
    private int page;
    private int size;
    private List<HubPaymentRequestResponse.CodLine> codLines;
    private String warning;
}
