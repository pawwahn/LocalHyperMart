package com.hyperlocalmart.user.dto.request;

import lombok.Data;

@Data
public class UpdatePrivacyPreferencesRequest {

    /** When non-null, sets marketing SMS/push promotional consent. */
    private Boolean marketingConsent;
}
