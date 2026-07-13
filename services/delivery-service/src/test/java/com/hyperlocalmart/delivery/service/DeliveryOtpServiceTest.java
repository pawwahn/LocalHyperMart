package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.delivery.config.DeliveryOtpProperties;
import com.hyperlocalmart.delivery.entity.DeliveryOtp;
import com.hyperlocalmart.delivery.repository.DeliveryOtpRepository;
import com.hyperlocalmart.delivery.util.HashUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryOtpServiceTest {

    @Mock private DeliveryOtpRepository deliveryOtpRepository;
    private DeliveryOtpProperties otpProperties;
    private DeliveryOtpService deliveryOtpService;

    @BeforeEach
    void setUp() {
        otpProperties = new DeliveryOtpProperties();
        deliveryOtpService = new DeliveryOtpService(deliveryOtpRepository, otpProperties);
    }

    @Test
    void issueOtp_usesFixedCodeWhenConfigured() {
        otpProperties.setFixedCode("111111");
        when(deliveryOtpRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        String otp = deliveryOtpService.issueOtp(UUID.randomUUID());

        assertThat(otp).isEqualTo("111111");
        ArgumentCaptor<DeliveryOtp> captor = ArgumentCaptor.forClass(DeliveryOtp.class);
        verify(deliveryOtpRepository).save(captor.capture());
        assertThat(captor.getValue().getOtpHash()).isEqualTo(HashUtils.sha256("111111"));
    }

    @Test
    void verifyOtp_acceptsFixedDevCodeEvenWhenStoredHashDiffers() {
        otpProperties.setFixedCode("111111");
        UUID orderId = UUID.randomUUID();
        DeliveryOtp record = DeliveryOtp.builder()
                .orderId(orderId)
                .otpHash(HashUtils.sha256("482910"))
                .attempts(5)
                .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                .build();
        when(deliveryOtpRepository.findFirstByOrderIdAndVerifiedAtIsNullOrderByCreatedAtDesc(orderId))
                .thenReturn(Optional.of(record));
        when(deliveryOtpRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        deliveryOtpService.verifyOtp(orderId, "111111");

        assertThat(record.getVerifiedAt()).isNotNull();
    }

    @Test
    void verifyOtp_acceptsMatchingOtp() {
        UUID orderId = UUID.randomUUID();
        String otp = "482910";
        DeliveryOtp record = DeliveryOtp.builder()
                .orderId(orderId)
                .otpHash(HashUtils.sha256(otp))
                .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                .build();
        when(deliveryOtpRepository.findFirstByOrderIdAndVerifiedAtIsNullOrderByCreatedAtDesc(orderId))
                .thenReturn(Optional.of(record));
        when(deliveryOtpRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        deliveryOtpService.verifyOtp(orderId, otp);

        ArgumentCaptor<DeliveryOtp> captor = ArgumentCaptor.forClass(DeliveryOtp.class);
        verify(deliveryOtpRepository).save(captor.capture());
        assertThat(captor.getValue().getVerifiedAt()).isNotNull();
    }

    @Test
    void verifyOtp_rejectsInvalidOtp() {
        UUID orderId = UUID.randomUUID();
        DeliveryOtp record = DeliveryOtp.builder()
                .orderId(orderId)
                .otpHash(HashUtils.sha256("111111"))
                .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                .build();
        when(deliveryOtpRepository.findFirstByOrderIdAndVerifiedAtIsNullOrderByCreatedAtDesc(orderId))
                .thenReturn(Optional.of(record));
        when(deliveryOtpRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThatThrownBy(() -> deliveryOtpService.verifyOtp(orderId, "999999"))
                .isInstanceOf(BusinessException.class);
        assertThat(record.getAttempts()).isEqualTo(1);
    }
}
