package com.hyperlocalmart.payment.config;

import com.hyperlocalmart.common.security.SecretStringCrypto;
import com.hyperlocalmart.payment.service.PaymentGatewaySecretCodec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PaymentSecretsConfiguration {

    @Bean
    PaymentGatewaySecretCodec paymentGatewaySecretCodec(
            @Value("${hyperlocalmart.secrets-encryption.key:}") String encryptionKey) {
        if (encryptionKey == null || encryptionKey.isBlank()) {
            return PaymentGatewaySecretCodec.plaintextOnly();
        }
        return PaymentGatewaySecretCodec.withCrypto(SecretStringCrypto.fromConfig(encryptionKey));
    }
}
