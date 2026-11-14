package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.payment.config.PaymentAdmissionProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PaymentAdmissionServiceTest {

    private PaymentAdmissionProperties properties;
    private MockEnvironment environment;

    @BeforeEach
    void setUp() {
        properties = new PaymentAdmissionProperties();
        properties.setEnabled(true);
        properties.setMaxPerSecond(2);
        properties.setMaxWaitMs(200L);
        properties.setRetryIntervalMs(10L);
        environment = new MockEnvironment();
        environment.setProperty("spring.data.redis.host", "");
    }

    @Test
    void awaitInitiateSlot_allowsUpToMaxPerSecondLocally() {
        PaymentAdmissionService service = new ServiceBuilder().build();
        assertThatCode(service::awaitInitiateSlot).doesNotThrowAnyException();
        assertThatCode(service::awaitInitiateSlot).doesNotThrowAnyException();
    }

    @Test
    void awaitInitiateSlot_failsWhenOverCapacityInSameSecond() {
        properties.setMaxPerSecond(1);
        properties.setMaxWaitMs(0L);
        PaymentAdmissionService service = new ServiceBuilder().build();
        service.awaitInitiateSlot();
        assertThatThrownBy(service::awaitInitiateSlot)
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("high demand");
    }

    @Test
    void awaitInitiateSlot_noOpWhenDisabled() {
        properties.setEnabled(false);
        PaymentAdmissionService service = new ServiceBuilder().build();
        for (int i = 0; i < 10; i++) {
            assertThatCode(service::awaitInitiateSlot).doesNotThrowAnyException();
        }
    }

    private final class ServiceBuilder {
        PaymentAdmissionService build() {
            @SuppressWarnings("unchecked")
            ObjectProvider<org.springframework.data.redis.core.StringRedisTemplate> provider =
                    mock(ObjectProvider.class);
            when(provider.getIfAvailable()).thenReturn(null);
            Environment env = environment;
            return new PaymentAdmissionService(properties, provider, env);
        }
    }
}
