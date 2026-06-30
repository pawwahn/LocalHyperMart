package com.hyperlocalmart.notification.service;

import com.hyperlocalmart.notification.dto.request.SendNotificationRequest;
import com.hyperlocalmart.notification.dto.response.NotificationResponse;
import com.hyperlocalmart.notification.entity.NotificationChannel;
import com.hyperlocalmart.notification.entity.NotificationLogStatus;
import com.hyperlocalmart.notification.entity.NotificationTemplate;
import com.hyperlocalmart.notification.entity.TemplateStatus;
import com.hyperlocalmart.notification.repository.NotificationLogRepository;
import com.hyperlocalmart.notification.repository.NotificationTemplateRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationTemplateRepository notificationTemplateRepository;

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void send_rendersTemplateAndLogsSent() {
        UUID orderId = UUID.randomUUID();
        NotificationTemplate template = NotificationTemplate.builder()
                .eventCode("ORDER_PLACED")
                .channel(NotificationChannel.SMS)
                .language("en")
                .bodyTemplate("HyperLocalMart: Order {{orderNumber}} placed. Total Rs {{totalAmount}}.")
                .status(TemplateStatus.ACTIVE)
                .build();

        SendNotificationRequest request = new SendNotificationRequest();
        request.setEventCode("ORDER_PLACED");
        request.setOrderId(orderId);
        request.setRecipientPhone("9876543210");
        request.setParams(Map.of("orderNumber", "ORD-1001", "totalAmount", "538.00"));

        when(notificationTemplateRepository.findByEventCodeAndChannelAndLanguageAndStatus(
                eq("ORDER_PLACED"), eq(NotificationChannel.SMS), eq("en"), eq(TemplateStatus.ACTIVE)))
                .thenReturn(Optional.of(template));
        when(notificationLogRepository.save(any())).thenAnswer(invocation -> {
            com.hyperlocalmart.notification.entity.NotificationLog log = invocation.getArgument(0);
            log.setId(UUID.randomUUID());
            return log;
        });

        NotificationResponse response = notificationService.send(request);

        assertThat(response.getStatus()).isEqualTo(NotificationLogStatus.SENT);
        assertThat(response.getBody()).isEqualTo("HyperLocalMart: Order ORD-1001 placed. Total Rs 538.00.");
        assertThat(response.getLogId()).isNotNull();
    }
}
