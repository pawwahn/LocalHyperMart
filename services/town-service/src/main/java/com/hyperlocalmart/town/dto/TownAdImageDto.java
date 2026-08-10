package com.hyperlocalmart.town.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TownAdImageDto {
    private String url;
    private String mediaId;
}
