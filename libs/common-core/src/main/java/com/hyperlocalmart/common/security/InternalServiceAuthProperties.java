package com.hyperlocalmart.common.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "hyperlocalmart.security")
public class InternalServiceAuthProperties {

    private String internalServiceSecret = "";

    public boolean isEnabled() {
        return internalServiceSecret != null && !internalServiceSecret.isBlank();
    }
}
