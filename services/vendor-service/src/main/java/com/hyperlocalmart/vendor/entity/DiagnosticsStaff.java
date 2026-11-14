package com.hyperlocalmart.vendor.entity;

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

import java.util.UUID;

@Entity
@Table(name = "diagnostics_staff")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagnosticsStaff extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;

    @Column(name = "role_type", nullable = false, length = 20)
    @Builder.Default
    private String roleType = "LAB_STAFF";

    @Column(length = 30)
    private String title;

    @Column(name = "collection_capable", nullable = false)
    @Builder.Default
    private boolean collectionCapable = false;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;
}
