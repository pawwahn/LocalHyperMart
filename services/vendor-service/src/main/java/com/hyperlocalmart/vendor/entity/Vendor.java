package com.hyperlocalmart.vendor.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "vendors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vendor extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "registration_request_id")
    private UUID registrationRequestId;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    @Column(name = "owner_name")
    private String ownerName;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(name = "gst_number_enc")
    private String gstNumberEnc;

    @Column(name = "fssai_number", length = 32)
    private String fssaiNumber;

    @Column(name = "bank_account_enc")
    private String bankAccountEnc;

    @Column(name = "ifsc_enc")
    private String ifscEnc;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private VendorStatus status;

    @Column(name = "disabled_by")
    private UUID disabledBy;

    @Column(name = "disabled_reason")
    private String disabledReason;
}
