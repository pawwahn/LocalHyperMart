package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.config.RestClientFactory;
import com.hyperlocalmart.order.config.MediaServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class MediaClient {

    private final RestClientFactory restClients;
    private final MediaServiceProperties mediaServiceProperties;

    public MediaMeta meta(UUID mediaId) {
        RestClient client = restClients.forBaseUrl(mediaServiceProperties.getBaseUrl());
        try {
            ApiResponse<MediaMeta> response = client.get()
                    .uri("/api/v1/internal/media/{id}", mediaId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<MediaMeta>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Photo not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Photo not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not read photo");
        }
    }

    /** Deletes one stored file. Missing files are treated as already removed. */
    public void deleteOne(UUID mediaId) {
        RestClient client = restClients.forBaseUrl(mediaServiceProperties.getBaseUrl());
        try {
            client.delete()
                    .uri("/api/v1/internal/media/{id}", mediaId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                return;
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not delete photo");
        }
    }

    public MediaBytes loadContent(UUID mediaId) {
        RestClient client = restClients.forBaseUrl(mediaServiceProperties.getBaseUrl());
        try {
            ResponseEntity<byte[]> response = client.get()
                    .uri("/api/v1/internal/media/{id}/content", mediaId)
                    .retrieve()
                    .toEntity(byte[].class);
            byte[] bytes = response.getBody();
            if (bytes == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Photo not found");
            }
            String contentType = response.getHeaders().getContentType() != null
                    ? response.getHeaders().getContentType().toString()
                    : "application/octet-stream";
            return new MediaBytes(bytes, contentType);
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Photo not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not read photo");
        }
    }

    public record MediaMeta(UUID id, UUID ownerUserId, String context, String contentType) {
    }

    public record MediaBytes(byte[] bytes, String contentType) {
    }
}
