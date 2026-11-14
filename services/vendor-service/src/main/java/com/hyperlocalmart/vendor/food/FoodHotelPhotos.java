package com.hyperlocalmart.vendor.food;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.response.FoodHotelCardResponse;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class FoodHotelPhotos {

    public static final int MAX = 8;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private FoodHotelPhotos() {}

    public static List<UUID> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            List<String> tokens = MAPPER.readValue(raw.trim(), STRING_LIST);
            if (tokens == null || tokens.isEmpty()) {
                return List.of();
            }
            List<UUID> out = new ArrayList<>();
            for (String token : tokens) {
                if (token == null || token.isBlank()) {
                    continue;
                }
                out.add(UUID.fromString(token.trim()));
            }
            return out.size() > MAX ? out.subList(0, MAX) : out;
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hotel photo ids must be valid UUIDs");
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hotel photos could not be read");
        }
    }

    public static String serialize(List<UUID> ids) {
        List<UUID> normalized = normalize(ids);
        try {
            List<String> tokens = normalized.stream().map(UUID::toString).toList();
            return MAPPER.writeValueAsString(tokens);
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not save hotel photos");
        }
    }

    public static List<UUID> normalize(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        if (ids.size() > MAX) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "You can upload up to " + MAX + " hotel photos");
        }
        Set<UUID> seen = new LinkedHashSet<>();
        for (UUID id : ids) {
            if (id == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hotel photo id is required");
            }
            if (!seen.add(id)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Duplicate hotel photo");
            }
        }
        return List.copyOf(seen);
    }

    public static String rawOrEmpty(String raw) {
        return raw == null || raw.isBlank() ? "[]" : raw;
    }

    public static List<FoodHotelCardResponse.HotelPhoto> toRows(String raw) {
        return parse(rawOrEmpty(raw)).stream()
                .map(FoodHotelPhotos::toRow)
                .toList();
    }

    public static FoodHotelCardResponse.HotelPhoto toRow(UUID id) {
        return FoodHotelCardResponse.HotelPhoto.builder()
                .mediaId(id)
                .url("/api/v1/media/" + id + "/content")
                .build();
    }

    public static String contextLabel() {
        return "FOOD_HOTEL";
    }
}