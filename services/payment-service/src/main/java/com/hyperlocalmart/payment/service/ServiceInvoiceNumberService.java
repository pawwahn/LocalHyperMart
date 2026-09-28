package com.hyperlocalmart.payment.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class ServiceInvoiceNumberService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final EntityManager entityManager;

    /** Next vendor service-fee invoice number for the Indian financial year of {@code paidAt}. */
    public String allocate(Instant paidAt) {
        String fy = financialYear(paidAt);
        Number seq = (Number) entityManager.createNativeQuery("""
                INSERT INTO service_invoice_sequences (fy, last_value)
                VALUES (:fy, 1)
                ON CONFLICT (fy) DO UPDATE
                SET last_value = service_invoice_sequences.last_value + 1
                RETURNING last_value
                """)
                .setParameter("fy", fy)
                .getSingleResult();
        return "HLM/SF/" + fy + "/" + String.format("%04d", seq.intValue());
    }

    static String financialYear(Instant paidAt) {
        var zoned = (paidAt == null ? Instant.now() : paidAt).atZone(IST);
        int start = zoned.getMonthValue() >= 4 ? zoned.getYear() : zoned.getYear() - 1;
        return String.format("%02d-%02d", start % 100, (start + 1) % 100);
    }
}
