package com.hyperlocalmart.order.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "diagnostics_order_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagnosticsOrderLine extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "test_id")
    private UUID testId;

    @Column(name = "package_id")
    private UUID packageId;

    @Column(name = "package_name", length = 200)
    private String packageName;

    @Column(name = "test_name", nullable = false, length = 200)
    private String testName;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "result_value", length = 200)
    private String resultValue;

    @Column(name = "result_unit", length = 40)
    private String resultUnit;

    @Column(name = "reference_range", length = 120)
    private String referenceRange;

    @Column(name = "result_flag", length = 20)
    private String resultFlag;
}
