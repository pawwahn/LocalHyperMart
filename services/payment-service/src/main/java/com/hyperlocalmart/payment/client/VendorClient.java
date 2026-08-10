package com.hyperlocalmart.payment.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.VendorServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VendorClient {

    private final RestClient.Builder restClientBuilder;
    private final VendorServiceProperties vendorServiceProperties;

    public CommercialTermsQuote quoteCommercialTerms(
            UUID vendorId,
            LocalDate periodStart,
            LocalDate periodEnd,
            List<OrderLine> orderLines
    ) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new HashMap<>();
        body.put("periodStart", periodStart.toString());
        body.put("periodEnd", periodEnd.toString());
        body.put("markSubscriptionCharged", false);
        body.put("orderLines", orderLines == null ? List.of() : orderLines);
        try {
            ApiResponse<CommercialTermsQuote> response = client.post()
                    .uri("/api/v1/internal/vendors/{vendorId}/commercial-terms/quote", vendorId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<CommercialTermsQuote>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Billing fee quote returned empty");
            }
            return response.getData();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            String detail = ex.getResponseBodyAsString();
            if (ex.getStatusCode().value() == 400) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        extractMessage(detail, "Billing fees could not be calculated for this payout"));
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                    "Could not calculate billing fees from vendor service");
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                    "Could not calculate billing fees from vendor service");
        }
    }

    public void markSubscriptionCharged(UUID vendorId, LocalDate periodEnd) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        try {
            client.post()
                    .uri("/api/v1/internal/vendors/{vendorId}/commercial-terms/mark-subscription-charged", vendorId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("periodEnd", periodEnd.toString()))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                    "Payout recorded but failed to mark monthly subscription as charged — check Billing before next payout");
        }
    }

    private static String extractMessage(String body, String fallback) {
        if (body == null || body.isBlank()) {
            return fallback;
        }
        int idx = body.indexOf("\"message\"");
        if (idx < 0) {
            return fallback;
        }
        int start = body.indexOf(':', idx);
        if (start < 0) {
            return fallback;
        }
        int q1 = body.indexOf('"', start + 1);
        int q2 = q1 < 0 ? -1 : body.indexOf('"', q1 + 1);
        if (q1 < 0 || q2 < 0) {
            return fallback;
        }
        String msg = body.substring(q1 + 1, q2).trim();
        return msg.isBlank() ? fallback : msg;
    }

    public record OrderLine(BigDecimal amount, Instant placedAt) {
    }

    public record CommercialTermsQuote(
            UUID vendorId,
            String feeModel,
            BigDecimal grossAmount,
            int orderCount,
            BigDecimal commissionAmount,
            BigDecimal subscriptionAmount,
            BigDecimal totalFeeAmount,
            BigDecimal suggestedNet,
            boolean subscriptionIncluded,
            String appliedSlabLabel,
            List<String> breakdownLines
    ) {
    }
}
