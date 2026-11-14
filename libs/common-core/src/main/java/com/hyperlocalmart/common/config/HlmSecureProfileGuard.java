package com.hyperlocalmart.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Fail fast on weak defaults when {@code hlm-secure} is active (QA/production Compose).
 */
@Slf4j
@Component
@Profile("hlm-secure")
public class HlmSecureProfileGuard implements ApplicationRunner {

    private static final String DEV_JWT_MARKER = "hyperlocalmart-dev-secret";

    @Value("${hyperlocalmart.security.jwt.secret:}")
    private String jwtSecret;

    @Value("${hyperlocalmart.security.internal-service-secret:}")
    private String internalServiceSecret;

    private final Environment environment;

    public HlmSecureProfileGuard(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        requireStrong("JWT_SECRET", jwtSecret, 32, DEV_JWT_MARKER);
        requireStrong("HLM_INTERNAL_SERVICE_SECRET", internalServiceSecret, 24, null);

        if ("payment-service".equals(environment.getProperty("spring.application.name"))) {
            String bypass = environment.getProperty("hyperlocalmart.payment.dev-webhook-bypass-secret", "");
            if (bypass != null && !bypass.isBlank() && !"disabled".equalsIgnoreCase(bypass.trim())) {
                throw new IllegalStateException(
                        "PAYMENT_DEV_WEBHOOK_BYPASS must be unset in hlm-secure (QA/production)");
            }
            String encKey = environment.getProperty("hyperlocalmart.secrets-encryption.key", "");
            if (encKey == null || encKey.isBlank()) {
                throw new IllegalStateException(
                        "HLM_SECRETS_ENCRYPTION_KEY is required for payment-service in hlm-secure");
            }
            try {
                com.hyperlocalmart.common.security.SecretStringCrypto.fromConfig(encKey);
            } catch (RuntimeException ex) {
                throw new IllegalStateException("Invalid HLM_SECRETS_ENCRYPTION_KEY: " + ex.getMessage(), ex);
            }
        }

        log.info("hlm-secure startup checks passed");
    }

    private static void requireStrong(String name, String value, int minLen, String forbiddenSubstring) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " must be set in hlm-secure environments");
        }
        if (value.length() < minLen) {
            throw new IllegalStateException(name + " must be at least " + minLen + " characters in hlm-secure");
        }
        if (forbiddenSubstring != null && value.contains(forbiddenSubstring)) {
            throw new IllegalStateException(name + " must not use the local dev default in hlm-secure");
        }
    }
}
