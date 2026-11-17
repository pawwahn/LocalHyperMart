package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.dto.request.CancellationPenaltyLookupRequest;
import com.hyperlocalmart.payment.repository.SettlementLineItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CancellationPenaltyService {

    private static final String LEGACY_PREFIX = "Cancel penalty · ";

    private final SettlementLineItemRepository settlementLineItemRepository;

    @Transactional(readOnly = true)
    public Set<UUID> findPenalizedOrderIds(CancellationPenaltyLookupRequest request) {
        if (request == null || request.getOrders() == null || request.getOrders().isEmpty()) {
            return Set.of();
        }
        List<UUID> orderIds = request.getOrders().stream()
                .map(CancellationPenaltyLookupRequest.OrderRef::getOrderId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (orderIds.isEmpty()) {
            return Set.of();
        }
        Set<UUID> penalized = new HashSet<>(settlementLineItemRepository.findCancellationPenaltyOrderIds(orderIds));
        if (penalized.size() >= orderIds.size()) {
            return penalized;
        }
        Set<String> legacyNumbers = legacyPenaltyOrderNumbers();
        if (legacyNumbers.isEmpty()) {
            return penalized;
        }
        for (CancellationPenaltyLookupRequest.OrderRef ref : request.getOrders()) {
            if (ref == null || ref.getOrderId() == null || penalized.contains(ref.getOrderId())) {
                continue;
            }
            String num = ref.getOrderNumber() == null ? null : ref.getOrderNumber().trim();
            if (num != null && !num.isEmpty() && legacyNumbers.contains(num.toUpperCase(Locale.ROOT))) {
                penalized.add(ref.getOrderId());
            }
        }
        return penalized;
    }

    private Set<String> legacyPenaltyOrderNumbers() {
        Set<String> numbers = new HashSet<>();
        for (String description : settlementLineItemRepository.findLegacyCancellationPenaltyDescriptions()) {
            if (description == null || !description.startsWith(LEGACY_PREFIX)) {
                continue;
            }
            String rest = description.substring(LEGACY_PREFIX.length()).trim();
            int end = rest.indexOf('·');
            String num = (end < 0 ? rest : rest.substring(0, end)).trim();
            if (!num.isEmpty()) {
                numbers.add(num.toUpperCase(Locale.ROOT));
            }
        }
        return numbers;
    }
}