package com.hyperlocalmart.media.service;

import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

final class ImageFileSignatures {

    private ImageFileSignatures() {
    }

    static boolean matchesDeclaredType(String contentType, byte[] header) {
        if (!StringUtils.hasText(contentType) || header == null || header.length < 3) {
            return false;
        }
        return switch (contentType.trim().toLowerCase(Locale.ROOT)) {
            case "image/jpeg", "image/jpg" -> isJpeg(header);
            case "image/png" -> isPng(header);
            case "image/gif" -> isGif(header);
            case "image/webp" -> isWebp(header);
            default -> false;
        };
    }

    static byte[] readHeader(InputStream input, int maxBytes) throws IOException {
        byte[] buffer = new byte[maxBytes];
        int read = input.read(buffer);
        if (read <= 0) {
            return new byte[0];
        }
        if (read == buffer.length) {
            return buffer;
        }
        byte[] trimmed = new byte[read];
        System.arraycopy(buffer, 0, trimmed, 0, read);
        return trimmed;
    }

    private static boolean isJpeg(byte[] header) {
        return header.length >= 3
                && (header[0] & 0xFF) == 0xFF
                && (header[1] & 0xFF) == 0xD8
                && (header[2] & 0xFF) == 0xFF;
    }

    private static boolean isPng(byte[] header) {
        return header.length >= 8
                && header[0] == (byte) 0x89
                && header[1] == 0x50
                && header[2] == 0x4E
                && header[3] == 0x47;
    }

    private static boolean isGif(byte[] header) {
        if (header.length < 6) {
            return false;
        }
        String prefix = new String(header, 0, 6, java.nio.charset.StandardCharsets.US_ASCII);
        return "GIF87a".equals(prefix) || "GIF89a".equals(prefix);
    }

    private static boolean isWebp(byte[] header) {
        if (header.length < 12) {
            return false;
        }
        String riff = new String(header, 0, 4, java.nio.charset.StandardCharsets.US_ASCII);
        String webp = new String(header, 8, 4, java.nio.charset.StandardCharsets.US_ASCII);
        return "RIFF".equals(riff) && "WEBP".equals(webp);
    }
}
