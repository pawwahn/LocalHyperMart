package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.OrderScratchCard;
import com.hyperlocalmart.order.entity.ScratchCardStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderScratchCardRepository extends JpaRepository<OrderScratchCard, UUID> {

    boolean existsByOrderId(UUID orderId);

    Optional<OrderScratchCard> findByOrderIdAndBuyerId(UUID orderId, UUID buyerId);

    List<OrderScratchCard> findByBuyerIdAndStatusOrderByCreatedAtDesc(UUID buyerId, ScratchCardStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from OrderScratchCard c where c.orderId = :orderId and c.buyerId = :buyerId")
    Optional<OrderScratchCard> lockByOrderIdAndBuyerId(@Param("orderId") UUID orderId, @Param("buyerId") UUID buyerId);

    @Query("""
            select c.townId, count(c)
            from OrderScratchCard c
            where c.createdAt >= :fromTs and c.createdAt < :toTs
            group by c.townId
            """)
    List<Object[]> countIssuedBetween(@Param("fromTs") java.time.Instant fromTs, @Param("toTs") java.time.Instant toTs);

    @Query("""
            select c.townId, count(c)
            from OrderScratchCard c
            where c.townId = :townId and c.createdAt >= :fromTs and c.createdAt < :toTs
            group by c.townId
            """)
    List<Object[]> countIssuedBetweenForTown(
            @Param("townId") UUID townId,
            @Param("fromTs") java.time.Instant fromTs,
            @Param("toTs") java.time.Instant toTs);

    @Query("""
            select c.townId, count(c), coalesce(sum(c.revealedAmount), 0)
            from OrderScratchCard c
            where c.status = com.hyperlocalmart.order.entity.ScratchCardStatus.REVEALED
              and c.revealedAt >= :fromTs and c.revealedAt < :toTs
            group by c.townId
            """)
    List<Object[]> sumGiftedBetween(@Param("fromTs") java.time.Instant fromTs, @Param("toTs") java.time.Instant toTs);

    @Query("""
            select c.townId, count(c), coalesce(sum(c.revealedAmount), 0)
            from OrderScratchCard c
            where c.status = com.hyperlocalmart.order.entity.ScratchCardStatus.REVEALED
              and c.townId = :townId
              and c.revealedAt >= :fromTs and c.revealedAt < :toTs
            group by c.townId
            """)
    List<Object[]> sumGiftedBetweenForTown(
            @Param("townId") UUID townId,
            @Param("fromTs") java.time.Instant fromTs,
            @Param("toTs") java.time.Instant toTs);

    @Query("""
            select c.townId, count(c)
            from OrderScratchCard c
            where c.status = com.hyperlocalmart.order.entity.ScratchCardStatus.ISSUED
            group by c.townId
            """)
    List<Object[]> countUnopenedByTown();

    @Query("""
            select c.townId, count(c)
            from OrderScratchCard c
            where c.status = com.hyperlocalmart.order.entity.ScratchCardStatus.ISSUED
              and c.townId = :townId
            group by c.townId
            """)
    List<Object[]> countUnopenedForTown(@Param("townId") UUID townId);

    @Query("""
            select coalesce(sum(c.rewardMin), 0)
            from OrderScratchCard c
            where c.status = com.hyperlocalmart.order.entity.ScratchCardStatus.ISSUED
              and (:townId is null or c.townId = :townId)
            """)
    BigDecimal sumUnopenedMin(@Param("townId") UUID townId);

    @Query("""
            select coalesce(sum(c.rewardMax), 0)
            from OrderScratchCard c
            where c.status = com.hyperlocalmart.order.entity.ScratchCardStatus.ISSUED
              and (:townId is null or c.townId = :townId)
            """)
    BigDecimal sumUnopenedMax(@Param("townId") UUID townId);

    @Query("""
            select c from OrderScratchCard c
            where (:townId is null or c.townId = :townId)
              and (
                (c.createdAt >= :fromTs and c.createdAt < :toTs)
                or (c.revealedAt is not null and c.revealedAt >= :fromTs and c.revealedAt < :toTs)
              )
            order by c.createdAt desc
            """)
    List<OrderScratchCard> findActivityBetween(
            @Param("townId") UUID townId,
            @Param("fromTs") java.time.Instant fromTs,
            @Param("toTs") java.time.Instant toTs);
}
