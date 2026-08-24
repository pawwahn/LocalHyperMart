package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderHistorySuggestionService {

    private static final int MAX_LISTING_IDS = 12;

    private final OrderItemRepository orderItemRepository;

    @Transactional(readOnly = true)
    public List<UUID> recentListingIds(UUID buyerId, UUID townId, int limit) {
        int capped = Math.min(Math.max(limit, 1), MAX_LISTING_IDS);
        List<UUID> raw = orderItemRepository.findRecentListingIds(
                buyerId, townId, PageRequest.of(0, capped * 4));
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>();
        for (UUID listingId : raw) {
            if (listingId != null) {
                distinct.add(listingId);
            }
            if (distinct.size() >= capped) {
                break;
            }
        }
        return List.copyOf(distinct);
    }
}
