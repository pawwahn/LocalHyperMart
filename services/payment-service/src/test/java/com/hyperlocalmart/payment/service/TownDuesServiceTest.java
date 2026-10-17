package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.dto.response.TownDuesResponse;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import com.hyperlocalmart.payment.repository.CodCloseDayRepository;
import com.hyperlocalmart.payment.repository.CodHubPlatformRemittanceRepository;
import com.hyperlocalmart.payment.repository.HubPaymentRequestRepository;
import com.hyperlocalmart.payment.repository.HubPlatformPaymentSubmissionLineRepository;
import com.hyperlocalmart.payment.repository.SettlementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TownDuesServiceTest {

    @Mock private CodCloseDayLineItemRepository closeLineRepository;
    @Mock private CodCloseDayRepository closeDayRepository;
    @Mock private CodHubPlatformRemittanceRepository remittanceRepository;
    @Mock private HubPaymentRequestRepository requestRepository;
    @Mock private HubPlatformPaymentSubmissionLineRepository submissionLineRepository;
    @Mock private SettlementRepository settlementRepository;
    @Mock private TownClient townClient;
    @Mock private OpenAccountsService openAccountsService;

    @InjectMocks
    private TownDuesService townDuesService;

    private final UUID townId = UUID.randomUUID();
    private final UUID hubId = UUID.randomUUID();

    @BeforeEach
    void emptyOtherDues() {
        when(requestRepository.findByStatusInOrderByPeriodStartAsc(anyList())).thenReturn(List.of());
        when(requestRepository.findOpenForDuesBetween(anyList(), any(), any())).thenReturn(List.of());
        when(settlementRepository.findByStatusNotOrderByPeriodStartAsc(any())).thenReturn(List.of());
        when(settlementRepository.findOpenForDuesBetween(any(), any())).thenReturn(List.of());
        when(settlementRepository.findHubFranchisePeriodStarts(any(), any(), anyList())).thenReturn(List.of());
        when(submissionLineRepository.findVerifiedFranchisePeriodStarts(any(), any())).thenReturn(List.of());
        when(closeLineRepository.distinctHubTowns()).thenReturn(List.of());
        when(closeDayRepository.sumReceivedGroupedByHub()).thenReturn(List.of());
        when(remittanceRepository.sumAmountGroupedByHub()).thenReturn(List.of());
        when(openAccountsService.scan(nullable(LocalDate.class), nullable(LocalDate.class))).thenReturn(List.of());
    }

    @Test
    void unbilledCod_hidesCashAlreadyRemittedWithoutABill() {
        when(closeLineRepository.unbilledHubCod()).thenReturn(rows(
                townId, hubId, 27, new BigDecimal("8747.00"),
                LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 2)));
        when(closeDayRepository.sumReceivedGroupedByHub()).thenReturn(rows(
                townId, hubId, new BigDecimal("8747.00")));
        when(remittanceRepository.sumAmountGroupedByHub()).thenReturn(rows(
                townId, hubId, new BigDecimal("8747.00")));

        TownDuesResponse dues = townDuesService.dues(null, null);

        assertThat(dues.getTowns()).isEmpty();
        assertThat(dues.getSendBill()).isEqualByComparingTo("0");
    }

    @Test
    void unbilledCod_keepsCashStillHeldAtTheHub() {
        when(closeLineRepository.unbilledHubCod()).thenReturn(rows(
                townId, hubId, 27, new BigDecimal("8747.00"),
                LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 2)));
        when(closeDayRepository.sumReceivedGroupedByHub()).thenReturn(rows(
                townId, hubId, new BigDecimal("8747.00")));

        TownDuesResponse dues = townDuesService.dues(null, null);

        assertThat(dues.getSendBill()).isEqualByComparingTo("8747.00");
        TownDuesResponse.Line line = dues.getTowns().get(0).getLines().get(0);
        assertThat(line.getAction()).isEqualTo("SEND_BILL");
        assertThat(line.getItemCount()).isEqualTo(27);
    }

    @Test
    void unbilledCod_capsAtRemainingBalanceAfterPartialRemittance() {
        when(closeLineRepository.unbilledHubCod()).thenReturn(rows(
                townId, hubId, 27, new BigDecimal("8747.00"),
                LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 2)));
        when(closeDayRepository.sumReceivedGroupedByHub()).thenReturn(rows(
                townId, hubId, new BigDecimal("8747.00")));
        when(remittanceRepository.sumAmountGroupedByHub()).thenReturn(rows(
                townId, hubId, new BigDecimal("6747.00")));

        TownDuesResponse dues = townDuesService.dues(null, null);

        TownDuesResponse.Line line = dues.getTowns().get(0).getLines().get(0);
        assertThat(line.getAmount()).isEqualByComparingTo("2000.00");
        assertThat(line.getItemCount()).isZero();
    }

    @Test
    void franchise_hidesMonthAlreadyPaidWithoutAHubBill() {
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 31);
        when(closeLineRepository.unbilledHubCodBetween(from, to)).thenReturn(List.of());
        when(closeLineRepository.distinctHubTowns()).thenReturn(rows(townId, hubId));
        when(townClient.deliveryPayoutConfig(townId)).thenReturn(franchiseConfig());
        when(settlementRepository.findHubFranchisePeriodStarts(any(), any(), anyList())).thenReturn(rows(hubId, from));

        TownDuesResponse dues = townDuesService.dues(from, to);

        assertThat(dues.getTowns()).isEmpty();
    }

    @Test
    void franchise_hidesMonthConfirmedOnAVerifiedPayment() {
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 31);
        when(closeLineRepository.unbilledHubCodBetween(from, to)).thenReturn(List.of());
        when(closeLineRepository.distinctHubTowns()).thenReturn(rows(townId, hubId));
        when(townClient.deliveryPayoutConfig(townId)).thenReturn(franchiseConfig());
        when(submissionLineRepository.findVerifiedFranchisePeriodStarts(from, to)).thenReturn(rows(hubId, from));

        TownDuesResponse dues = townDuesService.dues(from, to);

        assertThat(dues.getTowns()).isEmpty();
    }

    @Test
    void franchise_stillAsksToSendBillWhenNothingWasCollected() {
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 31);
        when(closeLineRepository.unbilledHubCodBetween(from, to)).thenReturn(List.of());
        when(closeLineRepository.distinctHubTowns()).thenReturn(rows(townId, hubId));
        when(townClient.deliveryPayoutConfig(townId)).thenReturn(franchiseConfig());

        TownDuesResponse dues = townDuesService.dues(from, to);

        assertThat(dues.getSendBill()).isEqualByComparingTo("1000.00");
        assertThat(dues.getTowns().get(0).getLines().get(0).getWhat()).contains("send the bill");
    }

    private static List<Object[]> rows(Object... values) {
        return Collections.singletonList(values);
    }

    private static TownClient.DeliveryPayoutConfig franchiseConfig() {
        return new TownClient.DeliveryPayoutConfig(
                null,
                new TownClient.DeliveryPayoutConfig.Party(
                        true,
                        null,
                        new TownClient.DeliveryPayoutConfig.Franchise(
                                true, "MONTHLY", new BigDecimal("1000.00"), "2026-10-01")));
    }
}
