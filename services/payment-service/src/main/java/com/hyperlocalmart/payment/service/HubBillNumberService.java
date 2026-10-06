package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.entity.HubPaymentRequest;
import com.hyperlocalmart.payment.entity.HubPaymentRequestType;
import com.hyperlocalmart.payment.repository.HubPaymentRequestRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HubBillNumberService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final EntityManager entityManager;
    private final TownClient townClient;
    private final HubPaymentRequestRepository requestRepository;

    /**
     * One town-wide sequence for COD + franchise bills (Indian FY).
     * Format: CLX/FR/26-27/0001
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public String assign(HubPaymentRequest row) {
        ensureAssigned(row.getTownId());
        if (row.getDocumentNumber() != null && !row.getDocumentNumber().isBlank()) {
            return row.getDocumentNumber();
        }
        String number = nextNumber(row.getTownId(), row.getRequestType(), Instant.now());
        row.setDocumentNumber(number);
        return number;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureAssigned(UUID townId) {
        if (townId == null) {
            return;
        }
        List<HubPaymentRequest> missing =
                requestRepository.findByTownIdAndDocumentNumberIsNullOrderByCreatedAtAscIdAsc(townId);
        if (missing.isEmpty()) {
            return;
        }
        for (HubPaymentRequest row : missing) {
            Instant at = row.getCreatedAt() != null ? row.getCreatedAt() : Instant.now();
            row.setDocumentNumber(nextNumber(townId, row.getRequestType(), at));
        }
        requestRepository.saveAll(missing);
    }

    private String nextNumber(UUID townId, HubPaymentRequestType type, Instant at) {
        String townCode = townCode(townId);
        String fy = financialYear(at);
        Number seq = (Number) entityManager.createNativeQuery("""
                        INSERT INTO hub_bill_sequences (town_id, fy, last_value)
                        VALUES (CAST(:townId AS uuid), :fy, 1)
                        ON CONFLICT (town_id, fy) DO UPDATE
                        SET last_value = hub_bill_sequences.last_value + 1
                        RETURNING last_value
                        """)
                .setParameter("townId", townId.toString())
                .setParameter("fy", fy)
                .getSingleResult();
        String kind = type == HubPaymentRequestType.COD ? "COD" : "FR";
        return townCode + "/" + kind + "/" + fy + "/" + String.format("%04d", seq.intValue());
    }

    private String townCode(UUID townId) {
        TownClient.TownSummary summary;
        try {
            summary = townClient.getTownSummary(townId);
        } catch (RuntimeException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load town code for bill number");
        }
        String raw = summary == null ? null : summary.townCode();
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Town code is required to number bills");
        }
        String code = raw.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (code.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Town code is required to number bills");
        }
        return code.length() > 10 ? code.substring(0, 10) : code;
    }

    static String financialYear(Instant at) {
        var zoned = (at == null ? Instant.now() : at).atZone(IST);
        int start = zoned.getMonthValue() >= 4 ? zoned.getYear() : zoned.getYear() - 1;
        return String.format("%02d-%02d", start % 100, (start + 1) % 100);
    }
}
