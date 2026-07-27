package com.hyperlocalmart.user.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.invite")
public class InviteProperties {

    /** Comma-separated phones. Empty = allow all (dev). */
    private String buyerPhones = "";

    /** When true, register requires acceptedTerms=true. */
    private boolean requireTerms = true;

    public boolean isAllowlistEnabled() {
        return buyerPhones != null && !buyerPhones.isBlank();
    }

    public boolean isPhoneAllowed(String phone) {
        if (!isAllowlistEnabled()) {
            return true;
        }
        Set<String> allowed = Arrays.stream(buyerPhones.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
        return allowed.contains(phone);
    }
}
