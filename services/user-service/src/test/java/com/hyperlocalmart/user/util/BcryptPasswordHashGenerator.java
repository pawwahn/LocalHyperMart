package com.hyperlocalmart.user.util;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Print BCrypt hash: mvn test -pl services/user-service -Dtest=BcryptPasswordHashGenerator -DemitHash=true -q
 */
class BcryptPasswordHashGenerator {

    @Test
    void emitHash() {
        Assumptions.assumeTrue("true".equals(System.getProperty("emitHash")));
        System.out.println(new BCryptPasswordEncoder().encode("Password@123"));
    }
}
