package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.PaymentProperties;
import com.hyperlocalmart.payment.dto.request.GatewayAdminRequest;
import com.hyperlocalmart.payment.dto.response.GatewayAdminResponse;
import com.hyperlocalmart.payment.entity.PaymentGatewayConfig;
import com.hyperlocalmart.payment.phonepe.PhonePeClient;
import com.hyperlocalmart.payment.razorpay.RazorpayClient;
import com.hyperlocalmart.payment.repository.PaymentGatewayConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentGatewayConfigService {

    private static final String RAZORPAY = "RAZORPAY";
    private static final String CASHFREE = "CASHFREE";
    private static final String PHONEPE = "PHONEPE";
    private static final String SANDBOX = "sandbox";
    private static final String PRODUCTION = "production";
    private static final String CASHFREE_SANDBOX = "https://sandbox.cashfree.com/pg";
    private static final String CASHFREE_LIVE = "https://api.cashfree.com/pg";

    private final PaymentGatewayConfigRepository repository;
    private final PaymentProperties properties;
    private final RazorpayClient razorpayClient;
    private final PhonePeClient phonePeClient;

    @PostConstruct
    void loadSaved() {
        List<PaymentGatewayConfig> rows = repository.findAll();
        for (PaymentGatewayConfig row : rows) {
            apply(row);
        }
        if (!rows.isEmpty()) {
            refreshClients();
        }
    }

    @Transactional(readOnly = true)
    public List<GatewayAdminResponse> current() {
        Map<String, PaymentGatewayConfig> saved = repository.findAll().stream()
                .collect(Collectors.toMap(PaymentGatewayConfig::getGateway, Function.identity(), (a, b) -> a));
        return List.of(
                view(RAZORPAY, "Razorpay", saved.get(RAZORPAY)),
                view(CASHFREE, "Cashfree", saved.get(CASHFREE)),
                view(PHONEPE, "PhonePe", saved.get(PHONEPE)));
    }

    @Transactional
    public List<GatewayAdminResponse> save(List<GatewayAdminRequest> rows, UUID actorId) {
        if (rows == null || rows.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Add at least one gateway");
        }
        for (GatewayAdminRequest row : rows) {
            String gateway = normalize(row.getGateway());
            PaymentGatewayConfig entity = repository.findById(gateway).orElseGet(() -> {
                PaymentGatewayConfig created = new PaymentGatewayConfig();
                created.setGateway(gateway);
                created.setCreatedBy(actorId);
                return created;
            });
            entity.setEnabled(row.isEnabled());
            entity.setClientId(trim(row.getClientId()));
            entity.setClientSecret(trim(row.getClientSecret()));
            entity.setClientVersion(trim(row.getClientVersion()));
            entity.setWebhookSecret(trim(row.getWebhookSecret()));
            entity.setWebhookUsername(trim(row.getWebhookUsername()));
            entity.setWebhookPassword(trim(row.getWebhookPassword()));
            entity.setEnvironment(normalizeEnv(row.getEnvironment()));
            entity.setUpdatedBy(actorId);
            apply(repository.save(entity));
        }
        refreshClients();
        return current();
    }

    private void apply(PaymentGatewayConfig row) {
        String gateway = row.getGateway();
        if (RAZORPAY.equals(gateway)) {
            properties.setRazorpayAdminDisabled(!row.isEnabled());
            properties.setRazorpayKeyId(empty(row.getClientId()));
            properties.setRazorpayKeySecret(empty(row.getClientSecret()));
            properties.setRazorpayWebhookSecret(empty(row.getWebhookSecret()));
            return;
        }
        if (CASHFREE.equals(gateway)) {
            properties.setCashfreeAdminDisabled(!row.isEnabled());
            properties.setCashfreeClientId(empty(row.getClientId()));
            properties.setCashfreeClientSecret(empty(row.getClientSecret()));
            properties.setCashfreeApiBaseUrl(PRODUCTION.equals(row.getEnvironment()) ? CASHFREE_LIVE : CASHFREE_SANDBOX);
            return;
        }
        if (PHONEPE.equals(gateway)) {
            properties.setPhonepeAdminDisabled(!row.isEnabled());
            properties.setPhonepeClientId(empty(row.getClientId()));
            properties.setPhonepeClientSecret(empty(row.getClientSecret()));
            properties.setPhonepeClientVersion(row.getClientVersion() == null || row.getClientVersion().isBlank()
                    ? "1"
                    : row.getClientVersion().trim());
            properties.setPhonepeEnv(PRODUCTION.equals(row.getEnvironment()) ? PRODUCTION : SANDBOX);
            properties.setPhonepeWebhookUsername(empty(row.getWebhookUsername()));
            properties.setPhonepeWebhookPassword(empty(row.getWebhookPassword()));
        }
    }

    private GatewayAdminResponse view(String gateway, String label, PaymentGatewayConfig saved) {
        boolean enabled = saved != null ? saved.isEnabled() : configured(gateway);
        String environment = environmentOf(gateway, saved);
        return GatewayAdminResponse.builder()
                .gateway(gateway)
                .label(label)
                .enabled(enabled)
                .clientId(clientIdOf(gateway))
                .clientSecret(clientSecretOf(gateway))
                .clientVersion(PHONEPE.equals(gateway) ? empty(properties.getPhonepeClientVersion()) : "")
                .webhookSecret(RAZORPAY.equals(gateway) ? empty(properties.getRazorpayWebhookSecret()) : "")
                .webhookUsername(PHONEPE.equals(gateway) ? empty(properties.getPhonepeWebhookUsername()) : "")
                .webhookPassword(PHONEPE.equals(gateway) ? empty(properties.getPhonepeWebhookPassword()) : "")
                .environment(environment)
                .build();
    }

    private boolean configured(String gateway) {
        return switch (gateway) {
            case RAZORPAY -> properties.isRazorpayConfigured();
            case CASHFREE -> properties.isCashfreeConfigured();
            case PHONEPE -> properties.isPhonePeConfigured();
            default -> false;
        };
    }

    private String clientIdOf(String gateway) {
        return switch (gateway) {
            case RAZORPAY -> empty(properties.getRazorpayKeyId());
            case CASHFREE -> empty(properties.getCashfreeClientId());
            case PHONEPE -> empty(properties.getPhonepeClientId());
            default -> "";
        };
    }

    private String clientSecretOf(String gateway) {
        return switch (gateway) {
            case RAZORPAY -> empty(properties.getRazorpayKeySecret());
            case CASHFREE -> empty(properties.getCashfreeClientSecret());
            case PHONEPE -> empty(properties.getPhonepeClientSecret());
            default -> "";
        };
    }

    private String environmentOf(String gateway, PaymentGatewayConfig saved) {
        if (CASHFREE.equals(gateway)) {
            return properties.isCashfreeSandbox() ? SANDBOX : PRODUCTION;
        }
        if (PHONEPE.equals(gateway)) {
            return properties.isPhonePeSandbox() ? SANDBOX : PRODUCTION;
        }
        return saved == null || saved.getEnvironment() == null ? "" : saved.getEnvironment();
    }

    private void refreshClients() {
        razorpayClient.refreshCredentials();
        phonePeClient.clearAccessToken();
    }

    private static String normalize(String gateway) {
        if (gateway == null || gateway.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Choose a gateway");
        }
        String value = gateway.trim().toUpperCase(Locale.ROOT);
        if (!RAZORPAY.equals(value) && !CASHFREE.equals(value) && !PHONEPE.equals(value)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown payment gateway");
        }
        return value;
    }

    private static String normalizeEnv(String environment) {
        if (environment == null || environment.isBlank()) {
            return SANDBOX;
        }
        String value = environment.trim().toLowerCase(Locale.ROOT);
        if (PRODUCTION.equals(value) || "live".equals(value)) {
            return PRODUCTION;
        }
        return SANDBOX;
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String empty(String value) {
        return value == null ? "" : value.trim();
    }
}
