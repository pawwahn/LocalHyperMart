package com.hyperlocalmart.notification.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({UserServiceProperties.class, FcmProperties.class})
public class NotificationServiceConfig {
}
