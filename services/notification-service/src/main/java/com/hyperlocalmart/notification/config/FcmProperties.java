package com.hyperlocalmart.notification.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "hyperlocalmart.fcm")
public class FcmProperties {

    /** When false, PUSH logs use dev stubs (default for local/QA). */
    private boolean enabled = false;

    private String projectId;

    /** Path to Firebase service account JSON (FCM HTTP v1). */
    private String credentialsPath;
}
