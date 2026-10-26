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
@Table(name = "beauty_vendor_treatments")
@IdClass(BeautyVendorTreatment.Key.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BeautyVendorTreatment {

    @Id
    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Id
    @Column(name = "service_code", nullable = false, length = 30)
    private String serviceCode;

    @Column(nullable = false, length = 80)
    private String label;

    @Column(length = 120)
    private String hint;

    @Column(nullable = false, length = 8)
    @Builder.Default
    private String emoji = "✨";

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID vendorId;
        private String serviceCode;
    }
}
