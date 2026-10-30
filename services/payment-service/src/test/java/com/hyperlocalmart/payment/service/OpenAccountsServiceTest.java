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
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
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
    @Mock private HubCodCustodyService hubCodCustodyService;

    @InjectMocks
    private OpenAccountsService openAccountsService;

    private final UUID townId = UUID.randomUUID();
    private final UUID vendorId = UUID.randomUUID();

    @BeforeEach
    void quietDelivery() {
        when(closeLineRepository.distinctHubTowns()).thenReturn(List.of());
        when(closeLineRepository.findClosedOrderIds(any())).thenReturn(List.of());
        when(hubCodCustodyService.ordersAlreadyWithCompany(any())).thenReturn(Set.of());
        when(settlementService.listSubscriptionBills(any())).thenReturn(List.of());
        when(settlementService.settledSubOrderIds(any())).thenReturn(Set.of());
        when(vendorClient.getVendorShopDisplayName(vendorId)).thenReturn("P Mart Essentials");
        when(orderClient.getCodDeliveredRange(eq(townId), any(), any(), any(), any()))
                .thenReturn(new OrderClient.CodDeliveredOrders(townId, null, "", false, List.of()));
        // Force legacy scan path (mock returns empty list otherwise → no vendor lines).
        when(orderClient.settlementBagKeys(any(), any())).thenReturn(null);
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
    void shopHeldCash_twoBags_amountMatchesTownDuesStyleTotal() {
        when(orderClient.deliveredVendorTowns(any(), any())).thenReturn(List.of(
                new OrderClient.VendorTown(vendorId, townId)));
        SettlementCandidateView.Item bagA = bag("CLX/AP-031026-0001", "COD", "DECLARED_TO_VENDOR", false, "800.00");
        bagA = SettlementCandidateView.Item.builder()
                .subOrderId(bagA.getSubOrderId())
                .orderId(bagA.getOrderId())
                .orderNumber(bagA.getOrderNumber())
                .paymentMethod(bagA.getPaymentMethod())
                .codCashLocation(bagA.getCodCashLocation())
                .vendorAgentDelivery(bagA.isVendorAgentDelivery())
                .subtotal(bagA.getSubtotal())
                .placedAt(bagA.getPlacedAt())
                .deliveredAt(bagA.getDeliveredAt())
                .platformFee(new BigDecimal("1.50"))
                .alreadySettled(false)
                .build();
        SettlementCandidateView.Item bagB = bag("CLX/AP-211026-0001", "COD", "DECLARED_TO_VENDOR", false, "1045.00");
        bagB = SettlementCandidateView.Item.builder()
                .subOrderId(bagB.getSubOrderId())
                .orderId(bagB.getOrderId())
                .orderNumber(bagB.getOrderNumber())
                .paymentMethod(bagB.getPaymentMethod())
                .codCashLocation(bagB.getCodCashLocation())
                .vendorAgentDelivery(bagB.isVendorAgentDelivery())
                .subtotal(bagB.getSubtotal())
                .placedAt(bagB.getPlacedAt())
                .deliveredAt(bagB.getDeliveredAt())
                .platformFee(new BigDecimal("1.50"))
                .alreadySettled(false)
                .build();
        when(settlementService.listCandidates(eq(townId), eq(vendorId), any(), any())).thenReturn(
                SettlementCandidateView.builder()
                        .vendorId(vendorId)
                        .townId(townId)
                        .pendingClaimChargebacks(BigDecimal.ZERO)
                        .items(List.of(bagA, bagB))
                        .build());
        when(vendorClient.quoteCommercialTerms(eq(vendorId), any(), any(), anyList(), eq(false), eq(true)))
                .thenReturn(quote("1845.00", "138.38", "1706.62", "7.5%"));

        OpenAccountsService.Line line = openAccountsService.scan(null, null).get(0);

        assertThat(line.amount()).isEqualByComparingTo("141.38");
        assertThat(line.commission()).isEqualByComparingTo("138.38");
        assertThat(line.detail()).contains("commission ₹138.38", "platform fee ₹3.00");
    }

    @Test
    void shopHeldCash_includesPlatformFeeInAmount_notInCommissionColumn() {
        when(orderClient.deliveredVendorTowns(any(), any())).thenReturn(List.of(
                new OrderClient.VendorTown(vendorId, townId)));
        SettlementCandidateView.Item item = bag("CLX/AP-031026-0001", "COD", "DECLARED_TO_VENDOR", false, "800.00");
        item = SettlementCandidateView.Item.builder()
                .subOrderId(item.getSubOrderId())
                .orderId(item.getOrderId())
                .orderNumber(item.getOrderNumber())
                .paymentMethod(item.getPaymentMethod())
                .codCashLocation(item.getCodCashLocation())
                .vendorAgentDelivery(item.isVendorAgentDelivery())
                .subtotal(item.getSubtotal())
                .placedAt(item.getPlacedAt())
                .deliveredAt(item.getDeliveredAt())
                .platformFee(new BigDecimal("1.50"))
                .alreadySettled(false)
                .build();
        when(settlementService.listCandidates(eq(townId), eq(vendorId), any(), any())).thenReturn(
                SettlementCandidateView.builder()
                        .vendorId(vendorId)
                        .townId(townId)
                        .pendingClaimChargebacks(BigDecimal.ZERO)
                        .items(List.of(item))
                        .build());
        when(vendorClient.quoteCommercialTerms(eq(vendorId), any(), any(), anyList(), eq(false), eq(true)))
                .thenReturn(quote("800.00", "60.00", "740.00", "7.5%"));

        OpenAccountsService.Line line = openAccountsService.scan(null, null).get(0);

        assertThat(line.amount()).isEqualByComparingTo("61.50");
        assertThat(line.commission()).isEqualByComparingTo("60.00");
        assertThat(line.detail()).contains("platform fee ₹1.50");
    }

    @Test
    void deliveredCodBeforeBagDelivered_showsPlatformFeesWithoutHandover() {
        UUID orderId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        when(orderClient.deliveredVendorTowns(any(), any())).thenReturn(List.of(
                new OrderClient.VendorTown(vendorId, townId)));
        when(settlementService.listCandidates(eq(townId), eq(vendorId), any(), any())).thenReturn(
                SettlementCandidateView.builder()
                        .vendorId(vendorId)
                        .townId(townId)
                        .pendingClaimChargebacks(BigDecimal.ZERO)
                        .items(List.of())
                        .build());
        when(orderClient.getCodDeliveredRange(eq(townId), any(), any(), any(), any()))
                .thenReturn(new OrderClient.CodDeliveredOrders(
                        townId,
                        null,
                        "",
                        false,
                        List.of(new OrderClient.CodDeliveredItem(
                                orderId,
                                "CLX/AP-201026-0001",
                                new BigDecimal("839.00"),
                                Instant.parse("2026-10-20T12:00:00Z"),
                                "VENDOR"))));
        when(orderClient.codCashBreakdown(any())).thenReturn(List.of(
                new OrderClient.CodCashBreakdown(
                        orderId,
                        "CLX/AP-201026-0001",
                        Instant.parse("2026-10-20T12:00:00Z"),
                        new BigDecimal("839.00"),
                        "VENDOR",
                        null,
                        vendorId,
                        List.of(new OrderClient.VendorAllocation(
                                subOrderId,
                                vendorId,
                                "SUB-1",
                                new BigDecimal("787.00"),
                                new BigDecimal("800.00"))))));
        when(orderClient.settlementBagKeys(any(), any())).thenReturn(List.of());
        when(vendorClient.quoteCommercialTerms(eq(vendorId), any(), any(), anyList(), eq(false), eq(true)))
                .thenReturn(quote("787.00", "52.00", "735.00", "7.5%"));

        List<OpenAccountsService.Line> lines = openAccountsService.scan(null, null);

        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).action()).isEqualTo("SEND_BILL");
        assertThat(lines.get(0).what()).contains("Delivered COD");
        assertThat(lines.get(0).amount()).isEqualByComparingTo("104.00");
        assertThat(lines.get(0).reference()).isEqualTo("CLX/AP-201026-0001");
    }

    @Test
    void glamShopHeldAndOnlineSlice_producesSendBillAndPayLines() {
        UUID beautyVendor = UUID.fromString("c96f4110-c577-4c55-a4a6-abf4a79928c4");
        UUID chirala = UUID.fromString("a8e7366c-2bd8-4376-b18b-7ba110f4d69f");
        UUID visitBag = UUID.fromString("1e3b3524-f51c-4f1c-965d-6a110010027b");
        UUID onlineBag = UUID.nameUUIDFromBytes(("beauty-online:" + visitBag).getBytes(StandardCharsets.UTF_8));

        when(orderClient.settlementBagKeys(any(), any())).thenReturn(List.of(
                new OrderClient.BagKey(beautyVendor, chirala, visitBag),
                new OrderClient.BagKey(beautyVendor, chirala, onlineBag)));
        when(vendorClient.getVendorShopDisplayName(beautyVendor)).thenReturn("U V Beauty Parlour");
        when(settlementService.listCandidates(eq(chirala), eq(beautyVendor), any(), any())).thenReturn(
                SettlementCandidateView.builder()
                        .vendorId(beautyVendor)
                        .townId(chirala)
                        .pendingClaimChargebacks(BigDecimal.ZERO)
                        .items(List.of(
                                glamBag(onlineBag, "G261026-0001 (UPI with KoyaKart)", "ONLINE", false, "47.95", "50.00"),
                                glamBag(visitBag, "G261026-0001", "COD", true, "701.05", null)))
                        .build());
        when(vendorClient.quoteCommercialTerms(eq(beautyVendor), any(), any(), anyList(), eq(false), eq(true)))
                .thenReturn(quote("701.05", "50.00", "651.05", "flat"));

        List<OpenAccountsService.Line> lines = openAccountsService.scan(null, null);

        assertThat(lines.stream().filter(l -> "U V Beauty Parlour".equals(l.partyName())).toList())
                .hasSize(2);
        assertThat(lines.stream().anyMatch(l -> "SEND_BILL".equals(l.action()) && l.partyName().equals("U V Beauty Parlour")))
                .isTrue();
        assertThat(lines.stream().anyMatch(l -> "PAY".equals(l.action())
                && l.partyName().equals("U V Beauty Parlour")
                && l.amount().compareTo(new BigDecimal("50.00")) == 0))
                .isTrue();
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

    private static SettlementCandidateView.Item glamBag(
            UUID subOrderId,
            String orderNumber,
            String method,
            boolean vendorAgent,
            String subtotal,
            String onlineRemittance) {
        SettlementCandidateView.Item.ItemBuilder builder = SettlementCandidateView.Item.builder()
                .subOrderId(subOrderId)
                .orderId(subOrderId)
                .orderNumber(orderNumber)
                .paymentMethod(method)
                .vendorAgentDelivery(vendorAgent)
                .subtotal(new BigDecimal(subtotal))
                .platformFee(new BigDecimal("2.00"))
                .parlourPaymentFee(new BigDecimal("30.00"))
                .placedAt(Instant.parse("2026-10-25T19:07:09Z"))
                .deliveredAt(Instant.parse("2026-10-30T16:32:53Z"))
                .alreadySettled(false);
        if (onlineRemittance != null) {
            builder.onlineRemittanceAmount(new BigDecimal(onlineRemittance));
        }
        return builder.build();
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
