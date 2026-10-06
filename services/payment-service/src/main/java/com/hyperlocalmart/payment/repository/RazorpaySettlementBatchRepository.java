package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.RazorpaySettlementBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface RazorpaySettlementBatchRepository extends JpaRepository<RazorpaySettlementBatch, UUID> {

    List<RazorpaySettlementBatch> findBySettlementDateBetweenOrderBySettlementDateAscCreatedAtAsc(
            LocalDate from, LocalDate to);

    boolean existsByUtrReference(String utrReference);
}
