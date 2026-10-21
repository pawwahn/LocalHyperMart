package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.PaymentGatewayConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentGatewayConfigRepository extends JpaRepository<PaymentGatewayConfig, String> {
}
