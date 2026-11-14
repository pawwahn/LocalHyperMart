package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateVendorAgentRequest {

    @NotBlank
    @Size(max = 120)
    private String name;

    @Size(max = 30)
    private String govtIdType;

    @Size(max = 40)
    private String govtIdNumber;

    @Size(max = 120)
    private String reference1Name;

    @Size(max = 15)
    private String reference1Phone;

    @Size(max = 120)
    private String reference2Name;

    @Size(max = 15)
    private String reference2Phone;

    @Size(max = 30)
    private String labTitle;

    private Boolean collectionCapable;
}
