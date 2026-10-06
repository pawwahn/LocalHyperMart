package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "hub_payment_request_cod_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HubPaymentRequestCodLine extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private HubPaymentRequest request;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "order_number", length = 50)
    private String orderNumber;

    @Column(name = "close_date")
    private LocalDate closeDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
}
