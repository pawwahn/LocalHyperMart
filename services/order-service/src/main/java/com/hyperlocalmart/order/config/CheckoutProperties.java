package com.hyperlocalmart.order.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.checkout")
public class CheckoutProperties {

    private BigDecimal deliveryFee = new BigDecimal("40.00");
}
