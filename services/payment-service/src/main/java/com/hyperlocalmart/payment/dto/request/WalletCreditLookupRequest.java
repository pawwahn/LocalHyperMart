package com.hyperlocalmart.payment.dto.request;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class WalletCreditLookupRequest {
    private List<String> referenceTypes = new ArrayList<>();
    private List<UUID> referenceIds = new ArrayList<>();
}
