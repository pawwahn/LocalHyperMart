package com.hyperlocalmart.media.dto;

import java.util.UUID;

public record MediaUploadResponse(
        UUID mediaId,
        String url,
        String contentType,
        String scanStatus
) {
}
