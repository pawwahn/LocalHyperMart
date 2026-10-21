package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ServiceOfferingListResponse {

    private List<ServiceOfferingResponse> items;
}
