package com.hyperlocalmart.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import com.hyperlocalmart.notification.client.DeviceTokenView;
import com.hyperlocalmart.notification.client.UserServiceClient;
import com.hyperlocalmart.notification.config.FcmProperties;
import com.hyperlocalmart.notification.dto.request.SendNotificationRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushDeliveryService {

    private static final String FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

    private final FcmProperties fcmProperties;
    private final UserServiceClient userServiceClient;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public String deliver(SendNotificationRequest request, String body) {
        if (request.getRecipientUserId() == null) {
            return devStubRef();
        }
        if (!fcmProperties.isEnabled()) {
            return devStubRef();
        }
        String projectId = fcmProperties.getProjectId();
        String credentialsPath = fcmProperties.getCredentialsPath();
        if (projectId == null || projectId.isBlank() || credentialsPath == null || credentialsPath.isBlank()) {
            log.warn("FCM enabled but projectId/credentialsPath missing; using push stub");
            return devStubRef();
        }

        String appType = PushAppTypeResolver.resolve(request.getEventCode());
        List<DeviceTokenView> tokens = userServiceClient.listDeviceTokens(request.getRecipientUserId(), appType);
        if (tokens.isEmpty()) {
            return "fcm-no-devices";
        }

        String accessToken;
        try {
            accessToken = loadAccessToken(credentialsPath);
        } catch (IOException ex) {
            log.warn("FCM credentials failed: {}", ex.getMessage());
            return devStubRef();
        }

        String title = "KoyaKart";
        String lastRef = "fcm-no-send";
        for (DeviceTokenView tokenView : tokens) {
            if (tokenView.getFcmToken() == null || tokenView.getFcmToken().isBlank()) {
                continue;
            }
            try {
                lastRef = sendOne(projectId, accessToken, tokenView.getFcmToken(), title, body, request);
            } catch (Exception ex) {
                log.warn("FCM send failed for user {}: {}", request.getRecipientUserId(), ex.getMessage());
            }
        }
        return lastRef;
    }

    private String sendOne(
            String projectId,
            String accessToken,
            String deviceToken,
            String title,
            String body,
            SendNotificationRequest request) throws IOException {
        Map<String, Object> notification = Map.of("title", title, "body", body);
        Map<String, String> data = new HashMap<>();
        data.put("eventCode", request.getEventCode());
        if (request.getOrderId() != null) {
            data.put("orderId", request.getOrderId().toString());
        }
        Map<String, Object> message = new HashMap<>();
        message.put("token", deviceToken);
        message.put("notification", notification);
        message.put("data", data);

        Map<String, Object> payload = Map.of("message", message);
        String json = objectMapper.writeValueAsString(payload);

        RestClient client = restClientBuilder.build();
        String responseBody = client.post()
                .uri("https://fcm.googleapis.com/v1/projects/{projectId}/messages:send", projectId)
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .body(json)
                .retrieve()
                .body(String.class);

        if (responseBody != null && responseBody.contains("\"name\"")) {
            int idx = responseBody.indexOf("\"name\"");
            return responseBody.substring(idx, Math.min(responseBody.length(), idx + 80)).replaceAll("\\s+", " ");
        }
        return "fcm-sent";
    }

    private static String loadAccessToken(String credentialsPath) throws IOException {
        try (InputStream in = new FileInputStream(credentialsPath)) {
            GoogleCredentials credentials = GoogleCredentials.fromStream(in).createScoped(FCM_SCOPE);
            credentials.refreshIfExpired();
            return credentials.getAccessToken().getTokenValue();
        }
    }

    private static String devStubRef() {
        return "dev-stub-" + UUID.randomUUID();
    }
}
