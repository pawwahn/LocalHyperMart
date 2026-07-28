package com.hyperlocalmart.media.dto;

public record MediaContent(
        byte[] bytes,
        String contentType
) {
}
