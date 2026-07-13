package com.hyperlocalmart.delivery.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.delivery.otp")
public class DeliveryOtpProperties {

    /**
     * When set (local/dev), every newly issued delivery OTP uses this fixed code
     * instead of a random value. Leave empty in production.
     */
    private String fixedCode = "";
}
