package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.WalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, UUID> {
    Optional<WalletTransaction> findByReferenceTypeAndReferenceIdAndType(
            String referenceType, UUID referenceId, String type);

    List<WalletTransaction> findByReferenceTypeInAndTypeAndReferenceIdIn(
            Collection<String> referenceTypes, String type, Collection<UUID> referenceIds);

    Page<WalletTransaction> findByWalletIdOrderByCreatedAtDesc(UUID walletId, Pageable pageable);

    @Query("""
            SELECT COALESCE(SUM(t.amount), 0) FROM WalletTransaction t
            WHERE t.type = :type AND t.createdAt >= :start AND t.createdAt < :end
            """)
    BigDecimal sumByTypeInRange(
            @Param("type") String type, @Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            SELECT COUNT(t) FROM WalletTransaction t
            WHERE t.type = :type AND t.createdAt >= :start AND t.createdAt < :end
            """)
    long countByTypeInRange(
            @Param("type") String type, @Param("start") Instant start, @Param("end") Instant end);

    List<WalletTransaction> findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
            Instant start, Instant endExclusive);

    @Query("""
            SELECT t.referenceType, COUNT(t), COALESCE(SUM(t.amount), 0)
            FROM WalletTransaction t
            WHERE t.type = :type AND t.createdAt >= :start AND t.createdAt < :end
            GROUP BY t.referenceType
            """)
    List<Object[]> sumByReferenceTypeInRange(
            @Param("type") String type, @Param("start") Instant start, @Param("end") Instant end);
}
