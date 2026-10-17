package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.CodCloseDayLineItem;
import com.hyperlocalmart.payment.entity.CodCustodianType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CodCloseDayLineItemRepository extends JpaRepository<CodCloseDayLineItem, UUID> {

    @Query("""
            SELECT li.orderId FROM CodCloseDayLineItem li
            WHERE li.orderId IN :orderIds
            """)
    List<UUID> findClosedOrderIds(@Param("orderIds") Collection<UUID> orderIds);

    @Query("""
            SELECT li FROM CodCloseDayLineItem li
            JOIN FETCH li.closeDay c
            WHERE li.orderId IN :orderIds
              AND c.townId = :townId
              AND c.hubId = :hubId
              AND c.custodianType = :custodianType
            """)
    List<CodCloseDayLineItem> findHubCloseLinesForOrders(
            @Param("townId") UUID townId,
            @Param("hubId") UUID hubId,
            @Param("custodianType") CodCustodianType custodianType,
            @Param("orderIds") Collection<UUID> orderIds);

    @Query("""
            SELECT li FROM CodCloseDayLineItem li
            JOIN FETCH li.closeDay c
            WHERE li.orderId IN :orderIds
              AND c.custodianType = com.hyperlocalmart.payment.entity.CodCustodianType.HUB
            """)
    List<CodCloseDayLineItem> findHubLinesForOrders(@Param("orderIds") Collection<UUID> orderIds);

    @Query("""
            SELECT li FROM CodCloseDayLineItem li
            JOIN FETCH li.closeDay c
            WHERE c.townId = :townId
              AND c.hubId = :hubId
              AND c.custodianType = :custodianType
              AND c.closeDate >= :from
              AND c.closeDate <= :to
            """)
    List<CodCloseDayLineItem> findHubCloseLinesInRange(
            @Param("townId") UUID townId,
            @Param("hubId") UUID hubId,
            @Param("custodianType") CodCustodianType custodianType,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(value = """
            SELECT CAST(c.town_id AS varchar), CAST(c.hub_id AS varchar), COUNT(*),
                   COALESCE(SUM(li.amount), 0), MIN(c.close_date), MAX(c.close_date)
            FROM cod_close_day_line_items li
            JOIN cod_close_days c ON c.id = li.close_day_id
            WHERE c.custodian_type = 'HUB'
              AND NOT EXISTS (
                SELECT 1 FROM hub_payment_request_cod_lines bl
                JOIN hub_payment_requests r ON r.id = bl.request_id
                WHERE bl.order_id = li.order_id
                  AND r.status IN ('ISSUED', 'PAYMENT_PENDING', 'APPROVED')
              )
            GROUP BY c.town_id, c.hub_id
            """, nativeQuery = true)
    List<Object[]> unbilledHubCod();

    @Query(value = """
            SELECT CAST(c.town_id AS varchar), CAST(c.hub_id AS varchar), COUNT(*),
                   COALESCE(SUM(li.amount), 0), MIN(c.close_date), MAX(c.close_date)
            FROM cod_close_day_line_items li
            JOIN cod_close_days c ON c.id = li.close_day_id
            WHERE c.custodian_type = 'HUB'
              AND c.close_date >= :from
              AND c.close_date <= :to
              AND NOT EXISTS (
                SELECT 1 FROM hub_payment_request_cod_lines bl
                JOIN hub_payment_requests r ON r.id = bl.request_id
                WHERE bl.order_id = li.order_id
                  AND r.status IN ('ISSUED', 'PAYMENT_PENDING', 'APPROVED')
              )
            GROUP BY c.town_id, c.hub_id
            """, nativeQuery = true)
    List<Object[]> unbilledHubCodBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT CAST(town_id AS varchar), CAST(hub_id AS varchar) FROM (
                SELECT town_id, hub_id FROM cod_close_days WHERE custodian_type = 'HUB'
                UNION
                SELECT town_id, hub_id FROM hub_payment_requests
            ) hubs
            """, nativeQuery = true)
    List<Object[]> distinctHubTowns();
}
