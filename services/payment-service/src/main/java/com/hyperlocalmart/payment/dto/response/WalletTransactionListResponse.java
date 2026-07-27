package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class WalletTransactionListResponse {
    List<WalletTransactionResponse> items;
    /** True when more rows exist beyond this page (offset + items). */
    boolean hasMore;
    int offset;
    int limit;
}
