package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.entity.DailyOrderSequence;
import com.hyperlocalmart.order.repository.DailyOrderSequenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderNumberGenerator {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    /** Display format: NRPT/AP-ddMMyy-0001 */
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("ddMMyy");

    private final DailyOrderSequenceRepository dailyOrderSequenceRepository;

    @Transactional
    public String nextOrderNumber(UUID townId, String townCode, String stateCode) {
        LocalDate orderDate = LocalDate.now(IST);
        DailyOrderSequence sequence = dailyOrderSequenceRepository.findByTownIdAndOrderDate(townId, orderDate)
                .orElseGet(() -> DailyOrderSequence.builder()
                        .townId(townId)
                        .orderDate(orderDate)
                        .lastSequence(0)
                        .build());
        sequence.setLastSequence(sequence.getLastSequence() + 1);
        dailyOrderSequenceRepository.save(sequence);
        return String.format("%s/%s-%s-%04d",
                townCode, stateCode, orderDate.format(DATE_FMT), sequence.getLastSequence());
    }

    public static String subOrderNumber(String orderNumber, int index, int total) {
        return orderNumber + "-" + index + "/" + total;
    }
}
