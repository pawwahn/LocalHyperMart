package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.entity.Settlement;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/** Vendor service-fee invoice numbers: KK/{FY}/{MON}/{seq}, e.g. KK/26-27/JUL/0001 — one series for all towns. */
@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceInvoiceNumberService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Pattern CURRENT_FORMAT = Pattern.compile("^KK/\\d{2}-\\d{2}/[A-Z]{3}/\\d{4,}$");

    private final EntityManager entityManager;
    private final TransactionTemplate transactionTemplate;

    /** Sequence runs for the whole Indian financial year; month is the issue month. */
    public String allocate(Instant paidAt) {
        Instant at = paidAt == null ? Instant.now() : paidAt;
        String fy = financialYear(at);
        Number seq = (Number) entityManager.createNativeQuery("""
                INSERT INTO service_invoice_sequences (fy, last_value)
                VALUES (:fy, 1)
                ON CONFLICT (fy) DO UPDATE
                SET last_value = service_invoice_sequences.last_value + 1
                RETURNING last_value
                """)
                .setParameter("fy", fy)
                .getSingleResult();
        String month = at.atZone(IST).getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                .toUpperCase(Locale.ROOT);
        return "KK/" + fy + "/" + month + "/" + String.format("%04d", seq.intValue());
    }

    /** Reissue numbers not yet on the KK/{FY}/{MON}/{seq} series, oldest payment first. */
    @EventListener(ApplicationReadyEvent.class)
    public void renumberLegacyInvoices() {
        try {
            Integer count = transactionTemplate.execute(status -> {
                List<Settlement> legacy = entityManager.createQuery("""
                        SELECT s FROM Settlement s
                        WHERE s.serviceInvoiceNumber IS NOT NULL
                        ORDER BY s.paidAt ASC, s.id ASC
                        """, Settlement.class)
                        .getResultList()
                        .stream()
                        .filter(s -> !CURRENT_FORMAT.matcher(s.getServiceInvoiceNumber()).matches())
                        .toList();
                if (legacy.isEmpty()) {
                    return 0;
                }
                legacy.forEach(s -> s.setServiceInvoiceNumber(null));
                entityManager.flush();
                for (Settlement s : legacy) {
                    s.setServiceInvoiceNumber(allocate(s.getPaidAt()));
                }
                return legacy.size();
            });
            if (count != null && count > 0) {
                log.info("Renumbered {} vendor service invoices to the KK/FY/MON series", count);
            }
        } catch (RuntimeException ex) {
            log.warn("Could not renumber legacy vendor invoices yet: {}", ex.getMessage());
        }
    }

    static String financialYear(Instant paidAt) {
        var zoned = (paidAt == null ? Instant.now() : paidAt).atZone(IST);
        int start = zoned.getMonthValue() >= 4 ? zoned.getYear() : zoned.getYear() - 1;
        return String.format("%02d-%02d", start % 100, (start + 1) % 100);
    }
}
