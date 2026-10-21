package com.hyperlocalmart.town.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a written drop address into one pin. Results are cached so OpenStreetMap's
 * public geocoder is called at most once per address, and never faster than its
 * one-request-a-second rule.
 */
@Service
public class AddressGeocodeService {

    static final String USER_AGENT = "KoyaKart/1.0 (delivery address lookup)";

    private final RestClient nominatim;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, Cached> cache = new ConcurrentHashMap<>();
    private final Object pace = new Object();
    private long lastCallMs;

    public AddressGeocodeService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(8));
        this.nominatim = RestClient.builder()
                .baseUrl("https://nominatim.openstreetmap.org")
                .requestFactory(requestFactory)
                .build();
    }

    public Optional<GeoHit> lookup(String raw) {
        String key = normalizeQuery(raw);
        if (key.length() < 3) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Address is too short to place on the map");
        }
        Cached cached = cache.get(key);
        if (cached != null && cached.fresh()) {
            return Optional.ofNullable(cached.hit());
        }
        synchronized (pace) {
            cached = cache.get(key);
            if (cached != null && cached.fresh()) {
                return Optional.ofNullable(cached.hit());
            }
            long wait = 1100L - (System.currentTimeMillis() - lastCallMs);
            if (lastCallMs > 0 && wait > 0) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Map lookup was interrupted. Use Open in Maps.");
                }
            }
            lastCallMs = System.currentTimeMillis();
            GeoHit hit = null;
            List<String> candidates = candidates(key);
            for (int i = 0; i < candidates.size(); i++) {
                if (i > 0) {
                    try {
                        Thread.sleep(1100L);
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Map lookup was interrupted. Use Open in Maps.");
                    }
                    lastCallMs = System.currentTimeMillis();
                }
                GeoHit found = callNominatim(candidates.get(i));
                if (found != null) {
                    boolean areaOnly = i > 0;
                    hit = new GeoHit(found.latitude(), found.longitude(), found.label(), areaOnly);
                    break;
                }
            }
            long ttl = hit == null ? 10 * 60_000L : 6 * 60 * 60_000L;
            cache.put(key, new Cached(hit, System.currentTimeMillis() + ttl));
            if (cache.size() > 1500) {
                cache.clear();
                if (hit != null) {
                    cache.put(key, new Cached(hit, System.currentTimeMillis() + ttl));
                }
            }
            return Optional.ofNullable(hit);
        }
    }

    static List<String> candidates(String normalized) {
        LinkedHashSet<String> queries = new LinkedHashSet<>();
        if (normalized.length() >= 3) {
            queries.add(normalized);
        }
        String withoutNear = stripNear(normalized);
        if (!withoutNear.equals(normalized) && withoutNear.length() >= 3) {
            queries.add(withoutNear);
        }
        String[] parts = withoutNear.split(",");
        if (parts.length >= 2) {
            String tail = (parts[parts.length - 2].trim() + ", " + parts[parts.length - 1].trim()).trim();
            if (tail.length() >= 3) {
                queries.add(tail);
            }
        }
        Matcher pin = PIN.matcher(normalized);
        if (pin.find()) {
            queries.add(pin.group(1) + ", india");
        }
        List<String> list = new ArrayList<>(queries);
        return list.size() > 3 ? list.subList(0, 3) : list;
    }

    private static String stripNear(String normalized) {
        String[] parts = normalized.split(",");
        StringBuilder kept = new StringBuilder();
        for (String part : parts) {
            String trimmed = part.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("near ")) {
                continue;
            }
            if (!kept.isEmpty()) {
                kept.append(", ");
            }
            kept.append(trimmed);
        }
        return kept.toString();
    }

    static String normalizeQuery(String raw) {
        if (raw == null) {
            return "";
        }
        String collapsed = raw.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return collapsed.length() > 240 ? collapsed.substring(0, 240) : collapsed;
    }

    private GeoHit callNominatim(String query) {
        String body;
        try {
            body = nominatim.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/search")
                            .queryParam("format", "jsonv2")
                            .queryParam("limit", 1)
                            .queryParam("countrycodes", "in")
                            .queryParam("q", query)
                            .build())
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "application/json")
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Map lookup is busy. Use Open in Maps.");
        }
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(body);
            if (!root.isArray() || root.isEmpty()) {
                return null;
            }
            JsonNode first = root.get(0);
            double lat = Double.parseDouble(first.path("lat").asText(""));
            double lng = Double.parseDouble(first.path("lon").asText(""));
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return null;
            }
            String label = first.path("display_name").asText("");
            if (label.length() > 180) {
                label = label.substring(0, 180);
            }
            return new GeoHit(lat, lng, label, false);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            return null;
        }
    }

    public record GeoHit(double latitude, double longitude, String label, boolean areaOnly) {
    }

    private static final Pattern PIN = Pattern.compile("\\b(\\d{6})\\b");

    private record Cached(GeoHit hit, long expiresAtMs) {
        boolean fresh() {
            return System.currentTimeMillis() < expiresAtMs;
        }
    }
}
