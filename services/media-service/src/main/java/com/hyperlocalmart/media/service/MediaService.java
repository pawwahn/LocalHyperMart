package com.hyperlocalmart.media.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.media.config.MediaProperties;
import com.hyperlocalmart.media.dto.MediaContent;
import com.hyperlocalmart.media.dto.MediaUploadResponse;
import com.hyperlocalmart.media.entity.MediaFile;
import com.hyperlocalmart.media.repository.MediaFileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MediaService {

    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
    );
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "image/gif", "gif"
    );

    private final MediaFileRepository mediaFileRepository;
    private final MediaProperties mediaProperties;

    @Transactional
    public MediaUploadResponse upload(MultipartFile file, String context, UUID userId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "File is required");
        }
        if (!StringUtils.hasText(context)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Context is required");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Only jpeg, png, webp, and gif images are allowed");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "File exceeds max size of 5MB");
        }

        UUID id = UUID.randomUUID();
        String extension = EXTENSIONS.get(contentType);
        Path storageRoot = Path.of(mediaProperties.getStorageDir()).toAbsolutePath().normalize();
        Path target = storageRoot.resolve(id + "." + extension);

        try {
            Files.createDirectories(storageRoot);
            file.transferTo(target);
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Failed to store media file");
        }

        String publicUrl = "/api/v1/media/" + id + "/content";
        MediaFile mediaFile = MediaFile.builder()
                .id(id)
                .originalName(file.getOriginalFilename() != null ? file.getOriginalFilename() : id + "." + extension)
                .contentType(contentType)
                .sizeBytes(file.getSize())
                .storagePath(target.toString())
                .context(context.trim().toUpperCase(Locale.ROOT))
                .ownerUserId(userId)
                .publicUrl(publicUrl)
                .scanStatus("CLEAN")
                .build();

        mediaFileRepository.saveAndFlush(mediaFile);

        return new MediaUploadResponse(mediaFile.getId(), mediaFile.getPublicUrl(),
                mediaFile.getContentType(), mediaFile.getScanStatus());
    }

    @Transactional(readOnly = true)
    public MediaContent loadContent(UUID id) {
        MediaFile mediaFile = mediaFileRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Media file not found"));
        try {
            byte[] bytes = Files.readAllBytes(Path.of(mediaFile.getStoragePath()));
            return new MediaContent(bytes, mediaFile.getContentType());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Failed to read media file");
        }
    }

    private static String normalizeContentType(String contentType) {
        if (!StringUtils.hasText(contentType)) {
            return "";
        }
        String normalized = contentType.trim().toLowerCase(Locale.ROOT);
        int semicolon = normalized.indexOf(';');
        if (semicolon >= 0) {
            normalized = normalized.substring(0, semicolon).trim();
        }
        if ("image/jpg".equals(normalized)) {
            return "image/jpeg";
        }
        return normalized;
    }
}
