package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReportNotReceivedRequest {
    /** Optional note the vendor wants KoyaKart to see. */
    @Size(max = 500)
    private String note;
}
