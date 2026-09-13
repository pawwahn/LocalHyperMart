package com.hyperlocalmart.town.legal;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Default legal copy shipped with the app. Super Admin can replace it in Platform settings.
 */
public final class DefaultLegalDocuments {

    public static final int MAX_CHARS = 80_000;
    public static final int DEFAULT_VERSION = 1;

    private static final String TERMS = load("legal/terms-default.txt");
    private static final String PRIVACY = load("legal/privacy-default.txt");
    private static final String REFUND = load("legal/refund-default.txt");

    private DefaultLegalDocuments() {
    }

    public static String terms() {
        return TERMS;
    }

    public static String privacy() {
        return PRIVACY;
    }

    public static String refund() {
        return REFUND;
    }

    private static String load(String classpath) {
        try (InputStream in = DefaultLegalDocuments.class.getClassLoader().getResourceAsStream(classpath)) {
            if (in == null) {
                throw new IllegalStateException("Missing classpath resource " + classpath);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).trim();
        } catch (IOException ex) {
            throw new IllegalStateException("Could not read " + classpath, ex);
        }
    }
}
