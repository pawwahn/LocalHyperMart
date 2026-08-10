package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateAgentRequest {

    @NotBlank
    @Size(max = 120)
    private String name;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid Indian mobile number")
    private String phone;

    @NotBlank
    @Size(min = 8, max = 100, message = "Password must be 8–100 characters")
    private String password;

    /** AADHAAR | VOTER_ID | DRIVING_LICENSE | PAN | OTHER */
    @NotBlank
    @Pattern(
            regexp = "^(AADHAAR|VOTER_ID|DRIVING_LICENSE|PAN|OTHER)$",
            message = "govtIdType must be AADHAAR, VOTER_ID, DRIVING_LICENSE, PAN, or OTHER")
    private String govtIdType;

    @NotBlank
    @Size(min = 4, max = 40)
    private String govtIdNumber;

    @NotBlank
    @Size(max = 120)
    private String reference1Name;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid reference 1 mobile number")
    private String reference1Phone;

    @NotBlank
    @Size(max = 120)
    private String reference2Name;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid reference 2 mobile number")
    private String reference2Phone;

    @AssertTrue(message = "Aadhaar number must be 12 digits")
    public boolean isGovtIdNumberValid() {
        if (govtIdType == null || govtIdNumber == null) {
            return true;
        }
        String digits = govtIdNumber.replaceAll("\\s", "");
        if ("AADHAAR".equalsIgnoreCase(govtIdType.trim())) {
            return digits.matches("^\\d{12}$");
        }
        return !digits.isBlank();
    }

    @AssertTrue(message = "Reference phones must differ from agent phone and each other")
    public boolean isReferencePhonesDistinct() {
        if (phone == null || reference1Phone == null || reference2Phone == null) {
            return true;
        }
        String agent = phone.trim();
        String r1 = reference1Phone.trim();
        String r2 = reference2Phone.trim();
        return !r1.equals(agent) && !r2.equals(agent) && !r1.equals(r2);
    }
}
