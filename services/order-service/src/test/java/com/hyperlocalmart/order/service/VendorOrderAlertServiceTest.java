package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.dto.request.CreateVendorOrderAlertRequest;
import com.hyperlocalmart.order.dto.response.VendorOrderAlertResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.VendorOrderAlert;
import com.hyperlocalmart.order.entity.VendorOrderAlertStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.VendorOrderAlertRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VendorOrderAlertServiceTest {

    @Mock private VendorOrderAlertRepository vendorOrderAlertRepository;
    @Mock private VendorSubOrderRepository vendorSubOrderRepository;
    @Mock private DeliveryClient deliveryClient;

    @InjectMocks
    private VendorOrderAlertService vendorOrderAlertService;

    @Test
    void createAlert_savesPendingForPlacedSubOrder() {
        UUID townId = UUID.randomUUID();
        UUID hubAdmin = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        VendorSubOrder sub = placedSubOrder(subOrderId, townId);

        when(deliveryClient.getHubAdminContext(hubAdmin))
                .thenReturn(new DeliveryClient.HubAdminContext(hubAdmin, UUID.randomUUID(), townId));
        when(vendorSubOrderRepository.findDetailedByIdWithItems(subOrderId)).thenReturn(Optional.of(sub));
        when(vendorOrderAlertRepository.existsByVendorSubOrderIdAndStatus(
                subOrderId, VendorOrderAlertStatus.PENDING)).thenReturn(false);
        when(vendorOrderAlertRepository.save(any())).thenAnswer(inv -> {
            VendorOrderAlert alert = inv.getArgument(0);
            alert.setId(UUID.randomUUID());
            return alert;
        });

        CreateVendorOrderAlertRequest request = new CreateVendorOrderAlertRequest();
        request.setMessage("Please pack now");
        VendorOrderAlertResponse response = vendorOrderAlertService.createAlert(
                hubAdmin, List.of("HUB_ADMIN"), subOrderId, townId, request);

        assertThat(response.getStatus()).isEqualTo(VendorOrderAlertStatus.PENDING);
        assertThat(response.getSubOrderId()).isEqualTo(subOrderId);
        assertThat(response.getMessage()).isEqualTo("Please pack now");
        assertThat(response.getShopName()).isEqualTo("Ravi Kirana");

        ArgumentCaptor<VendorOrderAlert> captor = ArgumentCaptor.forClass(VendorOrderAlert.class);
        verify(vendorOrderAlertRepository).save(captor.capture());
        assertThat(captor.getValue().getCreatedBy()).isEqualTo(hubAdmin);
        assertThat(captor.getValue().getVendorId()).isEqualTo(sub.getVendorId());
    }

    @Test
    void createAlert_rejectsDuplicatePending() {
        UUID townId = UUID.randomUUID();
        UUID hubAdmin = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        VendorSubOrder sub = placedSubOrder(subOrderId, townId);

        when(deliveryClient.getHubAdminContext(hubAdmin))
                .thenReturn(new DeliveryClient.HubAdminContext(hubAdmin, UUID.randomUUID(), townId));
        when(vendorSubOrderRepository.findDetailedByIdWithItems(subOrderId)).thenReturn(Optional.of(sub));
        when(vendorOrderAlertRepository.existsByVendorSubOrderIdAndStatus(
                subOrderId, VendorOrderAlertStatus.PENDING)).thenReturn(true);

        assertThatThrownBy(() -> vendorOrderAlertService.createAlert(
                hubAdmin, List.of("HUB_ADMIN"), subOrderId, townId, new CreateVendorOrderAlertRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.CONFLICT);
        verify(vendorOrderAlertRepository, never()).save(any());
    }

    @Test
    void createAlert_rejectsWrongTown() {
        UUID townId = UUID.randomUUID();
        UUID otherTown = UUID.randomUUID();
        UUID hubAdmin = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        VendorSubOrder sub = placedSubOrder(subOrderId, otherTown);

        when(deliveryClient.getHubAdminContext(hubAdmin))
                .thenReturn(new DeliveryClient.HubAdminContext(hubAdmin, UUID.randomUUID(), townId));
        when(vendorSubOrderRepository.findDetailedByIdWithItems(subOrderId)).thenReturn(Optional.of(sub));

        assertThatThrownBy(() -> vendorOrderAlertService.createAlert(
                hubAdmin, List.of("HUB_ADMIN"), subOrderId, townId, new CreateVendorOrderAlertRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    void createAlert_rejectsWhenShopAlreadyReady() {
        UUID townId = UUID.randomUUID();
        UUID hubAdmin = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        VendorSubOrder sub = placedSubOrder(subOrderId, townId);
        sub.setStatus(VendorSubOrderStatus.READY_FOR_PICKUP);

        when(deliveryClient.getHubAdminContext(hubAdmin))
                .thenReturn(new DeliveryClient.HubAdminContext(hubAdmin, UUID.randomUUID(), townId));
        when(vendorSubOrderRepository.findDetailedByIdWithItems(subOrderId)).thenReturn(Optional.of(sub));

        assertThatThrownBy(() -> vendorOrderAlertService.createAlert(
                hubAdmin, List.of("HUB_ADMIN"), subOrderId, townId, new CreateVendorOrderAlertRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    void createAlert_forbiddenWhenTownDoesNotMatchHub() {
        UUID townId = UUID.randomUUID();
        UUID hubTown = UUID.randomUUID();
        UUID hubAdmin = UUID.randomUUID();

        when(deliveryClient.getHubAdminContext(hubAdmin))
                .thenReturn(new DeliveryClient.HubAdminContext(hubAdmin, UUID.randomUUID(), hubTown));

        assertThatThrownBy(() -> vendorOrderAlertService.createAlert(
                hubAdmin, List.of("HUB_ADMIN"), UUID.randomUUID(), townId, new CreateVendorOrderAlertRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void acknowledge_marksAcknowledged() {
        UUID vendorId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID alertId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();
        VendorSubOrder sub = placedSubOrder(subOrderId, townId);
        VendorOrderAlert alert = VendorOrderAlert.builder()
                .id(alertId)
                .orderId(sub.getOrder().getId())
                .vendorSubOrderId(subOrderId)
                .vendorId(vendorId)
                .shopId(sub.getShopId())
                .townId(townId)
                .status(VendorOrderAlertStatus.PENDING)
                .createdBy(UUID.randomUUID())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        when(vendorOrderAlertRepository.findByIdAndVendorId(alertId, vendorId)).thenReturn(Optional.of(alert));
        when(vendorOrderAlertRepository.save(alert)).thenReturn(alert);
        when(vendorSubOrderRepository.findDetailedById(subOrderId)).thenReturn(Optional.of(sub));

        VendorOrderAlertResponse response = vendorOrderAlertService.acknowledge(vendorId, alertId, actorId);

        assertThat(response.getStatus()).isEqualTo(VendorOrderAlertStatus.ACKNOWLEDGED);
        assertThat(alert.getAcknowledgedBy()).isEqualTo(actorId);
        assertThat(alert.getAcknowledgedAt()).isNotNull();
    }

    @Test
    void acknowledge_rejectsOtherVendor() {
        UUID vendorId = UUID.randomUUID();
        when(vendorOrderAlertRepository.findByIdAndVendorId(any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vendorOrderAlertService.acknowledge(vendorId, UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    void createAlert_allowedAfterAcknowledge() {
        UUID townId = UUID.randomUUID();
        UUID hubAdmin = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        VendorSubOrder sub = placedSubOrder(subOrderId, townId);

        when(deliveryClient.getHubAdminContext(hubAdmin))
                .thenReturn(new DeliveryClient.HubAdminContext(hubAdmin, UUID.randomUUID(), townId));
        when(vendorSubOrderRepository.findDetailedByIdWithItems(subOrderId)).thenReturn(Optional.of(sub));
        when(vendorOrderAlertRepository.existsByVendorSubOrderIdAndStatus(
                subOrderId, VendorOrderAlertStatus.PENDING)).thenReturn(false);
        when(vendorOrderAlertRepository.save(any())).thenAnswer(inv -> {
            VendorOrderAlert alert = inv.getArgument(0);
            alert.setId(UUID.randomUUID());
            return alert;
        });

        VendorOrderAlertResponse response = vendorOrderAlertService.createAlert(
                hubAdmin, List.of("HUB_ADMIN"), subOrderId, townId, new CreateVendorOrderAlertRequest());

        assertThat(response.getStatus()).isEqualTo(VendorOrderAlertStatus.PENDING);
        verify(vendorOrderAlertRepository).save(any());
    }

    private VendorSubOrder placedSubOrder(UUID subOrderId, UUID townId) {
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00001")
                .townId(townId)
                .buyerId(UUID.randomUUID())
                .status(OrderStatus.PLACED)
                .vendorSubOrders(new ArrayList<>())
                .build();
        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(subOrderId)
                .order(order)
                .vendorId(UUID.randomUUID())
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00001-1/1")
                .status(VendorSubOrderStatus.PLACED)
                .subtotal(new BigDecimal("500.00"))
                .items(new ArrayList<>(List.of(OrderItem.builder()
                        .itemNameSnapshot("Tomato")
                        .shopNameSnapshot("Ravi Kirana")
                        .quantity(2)
                        .lineTotal(new BigDecimal("500.00"))
                        .build())))
                .build();
        order.getVendorSubOrders().add(subOrder);
        return subOrder;
    }
}
