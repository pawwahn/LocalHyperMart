package com.hyperlocalmart.user.entity;

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

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "patient_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientProfile extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "account_user_id", nullable = false)
    private UUID accountUserId;

    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;

    @Column(nullable = false, length = 30)
    private String relation;

    @Column(nullable = false, length = 20)
    private String gender;

    @Column(name = "age_years")
    private Integer ageYears;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(length = 400)
    private String notes;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;
}
