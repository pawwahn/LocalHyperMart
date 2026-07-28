package com.hyperlocalmart.media.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.media.dto.MediaContent;
import com.hyperlocalmart.media.dto.MediaUploadResponse;
import com.hyperlocalmart.media.security.AuthUserPrincipal;
import com.hyperlocalmart.media.service.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<MediaUploadResponse>> upload(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "context", defaultValue = "CATALOG_PRODUCT") String context,
            HttpServletRequest httpRequest) {
        requireUploader(principal);
        MediaUploadResponse uploaded = mediaService.upload(file, context, principal.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, uploaded));
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<byte[]> content(@PathVariable UUID id) {
        MediaContent media = mediaService.loadContent(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(media.contentType()))
                .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic())
                .body(media.bytes());
    }

    private void requireUploader(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Authentication required");
        }
        boolean allowed = principal.getRoles().contains("SUPER_ADMIN")
                || principal.getRoles().contains("VENDOR");
        if (!allowed) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor or super admin role required");
        }
    }
}
