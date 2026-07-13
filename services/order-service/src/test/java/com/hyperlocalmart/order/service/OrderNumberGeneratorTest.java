package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.DailyOrderSequence;
import com.hyperlocalmart.order.repository.DailyOrderSequenceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderNumberGeneratorTest {

    @Mock private DailyOrderSequenceRepository dailyOrderSequenceRepository;

    @InjectMocks
    private OrderNumberGenerator orderNumberGenerator;

    @Test
    void nextOrderNumber_formatsCorrectly() {
        UUID townId = UUID.randomUUID();
        when(dailyOrderSequenceRepository.findByTownIdAndOrderDate(any(), any(LocalDate.class)))
                .thenReturn(Optional.of(DailyOrderSequence.builder()
                        .townId(townId)
                        .orderDate(LocalDate.of(2026, 6, 24))
                        .lastSequence(0)
                        .build()));
        when(dailyOrderSequenceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        String orderNumber = orderNumberGenerator.nextOrderNumber(townId, "NRPT", "AP");

        assertThat(orderNumber).startsWith("NRPT/AP-");
        assertThat(orderNumber).endsWith("-O0001");
        ArgumentCaptor<DailyOrderSequence> captor = ArgumentCaptor.forClass(DailyOrderSequence.class);
        verify(dailyOrderSequenceRepository).save(captor.capture());
        assertThat(captor.getValue().getLastSequence()).isEqualTo(1);
    }

    @Test
    void subOrderNumber_appendsIndexAndTotal() {
        assertThat(OrderNumberGenerator.subOrderNumber("NRPT/AP-260708-O0001", 1, 3))
                .isEqualTo("NRPT/AP-260708-O0001-1/3");
        assertThat(OrderNumberGenerator.subOrderNumber("NRPT/AP-260708-O0001", 2, 3))
                .isEqualTo("NRPT/AP-260708-O0001-2/3");
    }
}
