package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.entity.PaymentGatewayConfig;
import com.hyperlocalmart.payment.repository.PaymentGatewayConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/** Re-encrypt legacy plaintext gateway secrets when encryption is enabled. */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentGatewaySecretsMigrator {

    private final PaymentGatewayConfigRepository repository;
    private final PaymentGatewaySecretCodec codec;

    @Transactional
    public void migratePlaintextSecretsIfNeeded() {
        if (!codec.isEncryptionEnabled()) {
            return;
        }
        List<PaymentGatewayConfig> dirty = new ArrayList<>();
        for (PaymentGatewayConfig row : repository.findAll()) {
            boolean changed = false;
            changed |= reencryptField(row.getClientSecret(), row::setClientSecret);
            changed |= reencryptField(row.getWebhookSecret(), row::setWebhookSecret);
            changed |= reencryptField(row.getWebhookPassword(), row::setWebhookPassword);
            if (changed) {
                dirty.add(row);
            }
        }
        if (!dirty.isEmpty()) {
            repository.saveAll(dirty);
            log.info("Encrypted payment gateway secrets at rest for {} gateway row(s)", dirty.size());
        }
    }

    private boolean reencryptField(String value, java.util.function.Consumer<String> setter) {
        if (value == null || value.isBlank()) {
            return false;
        }
        if (value.startsWith(com.hyperlocalmart.common.security.SecretStringCrypto.PREFIX)) {
            return false;
        }
        setter.accept(codec.encryptForStorage(value));
        return true;
    }
}
