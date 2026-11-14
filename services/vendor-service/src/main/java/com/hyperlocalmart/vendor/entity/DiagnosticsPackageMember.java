package com.hyperlocalmart.vendor.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "diagnostics_package_members")
@IdClass(DiagnosticsPackageMember.Key.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagnosticsPackageMember {

    @Id
    @Column(name = "package_id", nullable = false)
    private UUID packageId;

    @Id
    @Column(name = "test_id", nullable = false)
    private UUID testId;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID packageId;
        private UUID testId;
    }
}
