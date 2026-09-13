package com.hyperlocalmart.delivery.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminAgentAssignmentPage {

    private List<AssignmentResponse> items;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private long completedPickups;
    private long completedHomeDeliveries;
}
