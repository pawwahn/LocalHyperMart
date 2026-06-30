package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.IdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, UUID> {

    Optional<IdempotencyRecord> findByIdempotencyKeyAndExpiresAtAfter(String idempotencyKey, Instant now);
}
