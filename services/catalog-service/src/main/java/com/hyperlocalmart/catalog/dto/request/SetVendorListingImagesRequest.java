package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class SetVendorListingImagesRequest {

    @NotNull
    @Size(max = 3)
    private List<@NotNull ImageRef> images;

    @Data
    public static class ImageRef {
        @NotNull
        private UUID mediaId;

        @NotNull
        @Size(max = 500)
        private String url;
    }
}
