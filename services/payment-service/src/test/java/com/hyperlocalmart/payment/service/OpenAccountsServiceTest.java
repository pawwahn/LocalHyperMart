package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.client.VendorClient;
import com.hyperlocalmart.payment.dto.response.SettlementCandidateView;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OpenAccountsServiceTest {

    @Mock private OrderClient orderClient;
    @Mock private SettlementService settlementService;
    @Mock private DeliverySettlementService deliverySettlementService;
    @Mock private VendorClient vendorClient;
    @Mock private DeliveryClient deliveryClient;
    @Mock private TownClient townClient;
    @Mock private CodCloseDayLineItemRepository closeLineRepository;

    @InjectMocks
    private OpenAccountsService openAccountsService;

    private final UUID townId = UUID.randomUUID();
    private final UUID vendorId = UUID.randomUUID();

    @BeforeEach
    void quietDelivery() {
        when(closeLineRepository.distinctHubTowns()).thenReturn(List.of());
        when(settlementService.listSubscriptionBills(any())).thenReturn(List.of());
        when(vendorClient.getVendorShopDisplayName(vendorId)).thenReturn("P Mart Essentials");
    }

    @Test
    void shopHeldCash_becomesAFeeBillBeforeAnySettlementExists() {
        when(orderClient.deliveredVendorTowns(any(), any())).thenReturn(List.of(
                new OrderClient.VendorTown(vendorId, townId)));
        when(settlementService.listCandidates(eq(townId), eq(vendorId), any(), any())).thenReturn(
                SettlementCandidateView.builder()
                        .vendorId(vendorId)
                        .townId(townId)
                        .pendingClaimChargebacks(BigDecimal.ZERO)
                        .items(List.of(bag("CLX/AP-111026-0002", "COD", "WITH_VENDOR", false, "560.00")))
                        .build());
        when(vendorClient.quoteCommercialTerms(eq(vendorId), any(), any(), anyList(), eq(false), eq(true)))
                .thenReturn(quote("560.00", "42.00", "518.00", "7.5%"));

        List<OpenAccountsService.Line> lines = openAccountsService.scan(null, null);

        assertThat(lines).hasSize(1);
        OpenAccountsService.Line line = lines.get(0);
        assertThat(line.action()).isEqualTo("SEND_BILL");
        assertThat(line.partyName()).isEqualTo("P Mart Essentials");
        assertThat(line.amount()).isEqualByComparingTo("42.00");
        assertThat(line.commission()).isEqualByComparingTo("42.00");
        assertThat(line.detail()).contains("goods ₹560.00", "commission ₹42.00", "cash with shop", "CLX/AP-111026-0002");
        assertThat(line.reference()).isEqualTo("CLX/AP-111026-0002");
    }

    @Test
    void koyakartHeldMoney_becomesAPayout() {
        when(orderClient.deliveredVendorTowns(any(), any())).thenReturn(List.of(
                new OrderClient.VendorTown(vendorId, townId)));
        when(settlementService.listCandidates(eq(townId), eq(vendorId), any(), any())).thenReturn(
                SettlementCandidateView.builder()
                        .vendorId(vendorId)
                        .townId(townId)
                        .pendingClaimChargebacks(new BigDecimal("10.00"))
                        .items(List.of(bag("CLX/AP-111026-0003", "ONLINE", null, false, "200.00")))
                        .build());
        when(vendorClient.quoteCommercialTerms(eq(vendorId), any(), any(), anyList(), anyBoolean(), eq(false)))
                .thenReturn(quote("200.00", "15.00", "185.00", null));

        List<OpenAccountsService.Line> lines = openAccountsService.scan(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 17));

        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).action()).isEqualTo("PAY");
        assertThat(lines.get(0).amount()).isEqualByComparingTo("175.00");
        assertThat(lines.get(0).commission()).isEqualByComparingTo("15.00");
        assertThat(lines.get(0).detail()).contains("commission ₹15.00", "claim deduction ₹10.00", "pay ₹175.00");
    }

    @Test
    void alreadySettledBag_isLeftToTheSavedSettlement() {
        when(orderClient.deliveredVendorTowns(any(), any())).thenReturn(List.of(
                new OrderClient.VendorTown(vendorId, townId)));
        SettlementCandidateView.Item settled = SettlementCandidateView.Item.builder()
                .subOrderId(UUID.randomUUID())
                .orderId(UUID.randomUUID())
                .orderNumber("CLX/AP-111026-0004")
                .paymentMethod("COD")
                .codCashLocation("WITH_VENDOR")
                .subtotal(new BigDecimal("100.00"))
                .placedAt(Instant.parse("2026-10-11T08:00:00Z"))
                .alreadySettled(true)
                .build();
        when(settlementService.listCandidates(eq(townId), eq(vendorId), any(), any())).thenReturn(
                SettlementCandidateView.builder()
                        .items(List.of(settled))
                        .pendingClaimChargebacks(BigDecimal.ZERO)
                        .build());

        assertThat(openAccountsService.scan(null, null)).isEmpty();
    }

    private static SettlementCandidateView.Item bag(
            String orderNumber, String method, String location, boolean vendorAgent, String subtotal) {
        return SettlementCandidateView.Item.builder()
                .subOrderId(UUID.randomUUID())
                .orderId(UUID.randomUUID())
                .orderNumber(orderNumber)
                .paymentMethod(method)
                .codCashLocation(location)
                .vendorAgentDelivery(vendorAgent)
                .subtotal(new BigDecimal(subtotal))
                .placedAt(Instant.parse("2026-10-11T08:00:00Z"))
                .deliveredAt(Instant.parse("2026-10-11T12:00:00Z"))
                .alreadySettled(false)
                .build();
    }

    private static VendorClient.CommercialTermsQuote quote(String gross, String fee, String net, String slab) {
        return new VendorClient.CommercialTermsQuote(
                UUID.randomUUID(),
                "PERCENT",
                new BigDecimal(gross),
                1,
                new BigDecimal(fee),
                BigDecimal.ZERO,
                new BigDecimal(fee),
                new BigDecimal(net),
                false,
                slab,
                List.of());
    }
}
