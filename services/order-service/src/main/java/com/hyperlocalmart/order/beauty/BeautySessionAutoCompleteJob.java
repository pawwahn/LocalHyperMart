package com.hyperlocalmart.order.beauty;

import com.hyperlocalmart.order.service.BeautyOrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class BeautySessionAutoCompleteJob {

    private final BeautyOrderService beautyOrderService;

    /** End glam sessions past slot time so buyers still get scratch cards if the vendor forgets. */
    @Scheduled(fixedDelay = 300_000, initialDelay = 90_000)
    public void completePastSlotSessions() {
        int count = beautyOrderService.autoCompleteSessionsPastSlotEnd();
        if (count > 0) {
            log.info("Auto-completed {} glam session(s) after slot end", count);
        }
    }
}
