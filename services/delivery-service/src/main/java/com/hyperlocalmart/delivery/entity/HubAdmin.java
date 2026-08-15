package com.hyperlocalmart.delivery.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "hub_admins")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HubAdmin extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hub_id", nullable = false)
    private UUID hubId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "pin_hash")
    private String pinHash;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "ACTIVE";

    /** AADHAAR, VOTER_ID, DRIVING_LICENSE, PAN, OTHER */
    @Column(name = "govt_id_type", length = 30)
    private String govtIdType;

    @Column(name = "govt_id_number", length = 40)
    private String govtIdNumber;

    @Column(name = "reference1_name", length = 120)
    private String reference1Name;

    @Column(name = "reference1_phone", length = 15)
    private String reference1Phone;

    @Column(name = "reference2_name", length = 120)
    private String reference2Name;

    @Column(name = "reference2_phone", length = 15)
    private String reference2Phone;
}
