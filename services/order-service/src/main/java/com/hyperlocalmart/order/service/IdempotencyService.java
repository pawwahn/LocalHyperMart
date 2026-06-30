package com.hyperlocalmart.order.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.order.dto.response.CreateOrderResponse;
import com.hyperlocalmart.order.entity.IdempotencyRecord;
import com.hyperlocalmart.order.repository.IdempotencyRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private final IdempotencyRecordRepository idempotencyRecordRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public Optional<CreateOrderResponse> findValidResponse(String idempotencyKey) {
        return idempotencyRecordRepository.findByIdempotencyKeyAndExpiresAtAfter(idempotencyKey, Instant.now())
                .map(record -> objectMapper.convertValue(record.getResponseSnapshot(), CreateOrderResponse.class));
    }

    @Transactional
    public void save(String idempotencyKey, UUID userId, UUID orderId, CreateOrderResponse response) {
        Map<String, Object> snapshot = objectMapper.convertValue(response, Map.class);
        idempotencyRecordRepository.save(IdempotencyRecord.builder()
                .idempotencyKey(idempotencyKey)
                .userId(userId)
                .resourceType("ORDER")
                .resourceId(orderId)
                .responseSnapshot(snapshot)
                .expiresAt(Instant.now().plus(24, ChronoUnit.HOURS))
                .build());
    }
}
