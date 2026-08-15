package com.hyperlocalmart.order.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateVendorOrderAlertRequest {

    @Size(max = 500)
    private String message;
}
