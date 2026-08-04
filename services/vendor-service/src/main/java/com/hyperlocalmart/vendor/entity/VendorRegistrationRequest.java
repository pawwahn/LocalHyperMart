package com.hyperlocalmart.vendor.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vendor_registration_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VendorRegistrationRequest extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "requested_by", nullable = false)
    private UUID requestedBy;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    @Column(name = "owner_name")
    private String ownerName;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(name = "shop_name", nullable = false)
    private String shopName;

    private String address;

    @Column(name = "gst_number_enc")
    private String gstNumberEnc;

    @Column(name = "fssai_number", length = 32)
    private String fssaiNumber;

    @Column(name = "bank_account_enc")
    private String bankAccountEnc;

    @Column(name = "ifsc_enc")
    private String ifscEnc;

    @Column(name = "shop_image_media_id")
    private UUID shopImageMediaId;

    @Column(name = "gst_cert_media_id")
    private UUID gstCertMediaId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private RegistrationRequestStatus status;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reject_reason")
    private String rejectReason;

    @Column(name = "vendor_id")
    private UUID vendorId;
}
