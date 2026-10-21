package com.hyperlocalmart.media.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.media.service.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/media")
@RequiredArgsConstructor
public class MediaInternalController {

    private final MediaService mediaService;

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MediaService.MediaMeta>> meta(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, mediaService.meta(id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        mediaService.deleteOne(id);
        return ResponseEntity.noContent().build();
    }
}
