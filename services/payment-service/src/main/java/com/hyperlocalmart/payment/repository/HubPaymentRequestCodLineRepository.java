package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.HubPaymentRequestCodLine;
import com.hyperlocalmart.payment.entity.HubPaymentRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface HubPaymentRequestCodLineRepository extends JpaRepository<HubPaymentRequestCodLine, UUID> {

    @Query("""
            SELECT li.orderId FROM HubPaymentRequestCodLine li
            JOIN li.request r
            WHERE li.orderId IN :orderIds
              AND r.status IN :statuses
            """)
    List<UUID> findBlockedOrderIds(
            @Param("orderIds") Collection<UUID> orderIds,
            @Param("statuses") List<HubPaymentRequestStatus> statuses);

    Page<HubPaymentRequestCodLine> findByRequest_IdOrderByCloseDateAscIdAsc(UUID requestId, Pageable pageable);

    long countByRequest_Id(UUID requestId);

    @Query("""
            SELECT l.request.id, COUNT(l)
            FROM HubPaymentRequestCodLine l
            WHERE l.request.id IN :ids
            GROUP BY l.request.id
            """)
    List<Object[]> countByRequestIds(@Param("ids") Collection<UUID> ids);
}
