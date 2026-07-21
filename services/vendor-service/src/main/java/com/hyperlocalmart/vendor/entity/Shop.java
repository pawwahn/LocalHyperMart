package com.hyperlocalmart.vendor.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "shops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Shop extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vendor_id", nullable = false)
    private Vendor vendor;

    @Column(name = "shop_name", nullable = false)
    private String shopName;

    private String address;

    private String pincode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ShopStatus status;

    /** When false, shop is paused and should not appear in town browse. */
    @Column(name = "accepting_orders", nullable = false)
    @Builder.Default
    private boolean acceptingOrders = true;
}
