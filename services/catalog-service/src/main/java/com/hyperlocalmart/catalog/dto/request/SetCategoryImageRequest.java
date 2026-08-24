package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class SetCategoryImageRequest {

    private UUID mediaId;

    @Size(max = 500)
    private String url;
}
