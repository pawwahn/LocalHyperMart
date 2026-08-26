package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.dto.response.ScratchCardResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderScratchCard;
import com.hyperlocalmart.order.entity.ScratchCardStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderScratchCardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ScratchCardService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final OrderScratchCardRepository scratchCardRepository;
    private final OrderRepository orderRepository;
    private final TownClient townClient;
    private final PaymentClient paymentClient;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void issueIfEligible(Order order) {
        if (order == null || scratchCardRepository.existsByOrderId(order.getId())) {
            return;
        }
        TownClient.ScratchSettings settings = townClient.getScratchSettings(order.getTownId());
        if (!settings.enabled()) {
            return;
        }
        BigDecimal goodsPaid = goodsTotal(order);
        if (goodsPaid.compareTo(settings.minGoodsAmount()) <= 0) {
            return;
        }
        scratchCardRepository.save(OrderScratchCard.builder()
                .orderId(order.getId())
                .buyerId(order.getBuyerId())
                .townId(order.getTownId())
                .status(ScratchCardStatus.ISSUED)
                .rewardMin(settings.rewardMin().setScale(2, RoundingMode.HALF_UP))
                .rewardMax(settings.rewardMax().setScale(2, RoundingMode.HALF_UP))
                .build());
    }

    @Transactional(readOnly = true)
    public List<ScratchCardResponse> listPending(UUID buyerId) {
        return scratchCardRepository
                .findByBuyerIdAndStatusOrderByCreatedAtDesc(buyerId, ScratchCardStatus.ISSUED)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ScratchCardResponse getForOrder(UUID buyerId, UUID orderId) {
        return findForOrder(buyerId, orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "No scratch card for this order"));
    }

    @Transactional(readOnly = true)
    public java.util.Optional<ScratchCardResponse> findForOrder(UUID buyerId, UUID orderId) {
        return scratchCardRepository.findByOrderIdAndBuyerId(orderId, buyerId).map(this::toResponse);
    }

    @Transactional
    public ScratchCardResponse reveal(UUID buyerId, UUID orderId) {
        OrderScratchCard card = scratchCardRepository.lockByOrderIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "No scratch card for this order"));
        if (card.getStatus() == ScratchCardStatus.REVEALED && card.getRevealedAmount() != null) {
            return toResponse(card);
        }
        if (card.getRevealedAmount() == null) {
            card.setRevealedAmount(pickAmount(card.getRewardMin(), card.getRewardMax()));
            scratchCardRepository.saveAndFlush(card);
        }
        BigDecimal amount = card.getRevealedAmount();
        Order order = orderRepository.findById(orderId).orElse(null);
        String orderNumber = order != null ? order.getOrderNumber() : "";
        paymentClient.creditWallet(
                buyerId,
                amount,
                "SCRATCH_CARD",
                card.getId(),
                orderId,
                null,
                "Scratch card on order " + orderNumber);
        card.setStatus(ScratchCardStatus.REVEALED);
        card.setRevealedAt(Instant.now());
        scratchCardRepository.save(card);
        return toResponse(card);
    }

    static BigDecimal goodsTotal(Order order) {
        BigDecimal items = order.getItemsSubtotal() == null ? BigDecimal.ZERO : order.getItemsSubtotal();
        BigDecimal promo = order.getPromoDiscount() == null ? BigDecimal.ZERO : order.getPromoDiscount();
        return items.subtract(promo).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal pickAmount(BigDecimal min, BigDecimal max) {
        int lo = min.setScale(0, RoundingMode.CEILING).intValue();
        int hi = max.setScale(0, RoundingMode.FLOOR).intValue();
        if (hi < lo) {
            return min.setScale(0, RoundingMode.HALF_UP);
        }
        int value = lo + RANDOM.nextInt(hi - lo + 1);
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private ScratchCardResponse toResponse(OrderScratchCard card) {
        String orderNumber = orderRepository.findById(card.getOrderId())
                .map(Order::getOrderNumber)
                .orElse(null);
        return ScratchCardResponse.builder()
                .id(card.getId())
                .orderId(card.getOrderId())
                .orderNumber(orderNumber)
                .status(card.getStatus())
                .rewardMin(card.getRewardMin())
                .rewardMax(card.getRewardMax())
                .revealedAmount(card.getStatus() == ScratchCardStatus.REVEALED ? card.getRevealedAmount() : null)
                .build();
    }
}
