package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "payment_gateway_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentGatewayConfig extends BaseAuditEntity {

    @Id
    @Column(length = 30)
    private String gateway;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "client_id", length = 200)
    private String clientId;

    @Column(name = "client_secret", length = 500)
    private String clientSecret;

    @Column(name = "client_version", length = 40)
    private String clientVersion;

    @Column(name = "webhook_secret", length = 500)
    private String webhookSecret;

    @Column(name = "webhook_username", length = 120)
    private String webhookUsername;

    @Column(name = "webhook_password", length = 500)
    private String webhookPassword;

    @Column(length = 20)
    private String environment;
}
