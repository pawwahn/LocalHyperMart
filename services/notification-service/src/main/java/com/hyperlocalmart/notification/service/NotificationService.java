package com.hyperlocalmart.notification.service;

import com.hyperlocalmart.notification.dto.request.SendNotificationRequest;
import com.hyperlocalmart.notification.dto.response.BuyerNotificationResponse;
import com.hyperlocalmart.notification.dto.response.NotificationResponse;
import com.hyperlocalmart.notification.entity.NotificationChannel;
import com.hyperlocalmart.notification.entity.NotificationLog;
import com.hyperlocalmart.notification.entity.NotificationLogStatus;
import com.hyperlocalmart.notification.entity.NotificationTemplate;
import com.hyperlocalmart.notification.entity.TemplateStatus;
import com.hyperlocalmart.notification.repository.NotificationLogRepository;
import com.hyperlocalmart.notification.repository.NotificationTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final String DEFAULT_LANGUAGE = "en";
    private static final String SKIP_REASON_NO_TEMPLATE = "NO_ACTIVE_TEMPLATE";

    private final NotificationTemplateRepository notificationTemplateRepository;
    private final NotificationLogRepository notificationLogRepository;

    @Transactional
    public NotificationResponse send(SendNotificationRequest request) {
        NotificationChannel channel = request.getChannel() != null
                ? request.getChannel()
                : NotificationChannel.SMS;

        return notificationTemplateRepository
                .findByEventCodeAndChannelAndLanguageAndStatus(
                        request.getEventCode(), channel, DEFAULT_LANGUAGE, TemplateStatus.ACTIVE)
                .map(template -> sendWithTemplate(request, channel, template))
                .orElseGet(() -> skipNoTemplate(request, channel));
    }

    @Transactional(readOnly = true)
    public List<BuyerNotificationResponse> listForBuyer(UUID buyerId, int limit) {
        int size = Math.min(Math.max(limit, 1), 100);
        return notificationLogRepository
                .findByRecipientUserIdAndStatusOrderByCreatedAtDesc(
                        buyerId, NotificationLogStatus.SENT, PageRequest.of(0, size))
                .stream()
                .map(this::toBuyerResponse)
                .toList();
    }

    private NotificationResponse sendWithTemplate(
            SendNotificationRequest request, NotificationChannel channel, NotificationTemplate template) {
        String body = renderBody(template.getBodyTemplate(), request.getParams());
        NotificationLog log = buildLog(request, channel);
        log.setBody(body);
        log.setStatus(NotificationLogStatus.SENT);
        log.setProviderRef("dev-stub-" + UUID.randomUUID());
        NotificationLog saved = notificationLogRepository.save(log);
        return toResponse(saved);
    }

    private NotificationResponse skipNoTemplate(SendNotificationRequest request, NotificationChannel channel) {
        NotificationLog log = buildLog(request, channel);
        log.setStatus(NotificationLogStatus.SKIPPED);
        log.setSkipReason(SKIP_REASON_NO_TEMPLATE);
        NotificationLog saved = notificationLogRepository.save(log);
        return toResponse(saved);
    }

    private NotificationLog buildLog(SendNotificationRequest request, NotificationChannel channel) {
        return NotificationLog.builder()
                .townId(request.getTownId())
                .orderId(request.getOrderId())
                .recipientUserId(request.getRecipientUserId())
                .recipientPhone(request.getRecipientPhone())
                .channel(channel)
                .eventCode(request.getEventCode())
                .build();
    }

    private String renderBody(String template, Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return template;
        }
        String rendered = template;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            rendered = rendered.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return rendered;
    }

    private NotificationResponse toResponse(NotificationLog log) {
        return NotificationResponse.builder()
                .logId(log.getId())
                .status(log.getStatus())
                .body(log.getBody())
                .build();
    }

    private BuyerNotificationResponse toBuyerResponse(NotificationLog log) {
        return BuyerNotificationResponse.builder()
                .id(log.getId())
                .orderId(log.getOrderId())
                .eventCode(log.getEventCode())
                .channel(log.getChannel())
                .body(log.getBody())
                .status(log.getStatus())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
