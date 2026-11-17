package com.hyperlocalmart.order.job;

import com.hyperlocalmart.order.service.UnpaidOnlineOrderExpiryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class UnpaidOnlineOrderExpiryJob {

    private final UnpaidOnlineOrderExpiryService unpaidOnlineOrderExpiryService;

    /** Cancel grocery orders still awaiting online payment after 24 hours. */
    @Scheduled(fixedDelay = 900_000, initialDelay = 120_000)
    public void expireStaleUnpaidOrders() {
        int count = unpaidOnlineOrderExpiryService.expireStaleUnpaidOnlineOrders();
        if (count > 0) {
            log.info("Auto-cancelled {} unpaid online order(s) after payment timeout", count);
        }
    }
}