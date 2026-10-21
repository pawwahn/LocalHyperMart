package com.hyperlocalmart.order.laundry;

import com.hyperlocalmart.order.entity.LaundryOrderLine;
import com.hyperlocalmart.order.repository.LaundryOrderLineRepository;
import com.hyperlocalmart.order.service.LaundryOrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class LaundryPhotoPurgeJob {

    private final LaundryOrderLineRepository lineRepository;
    private final LaundryOrderService laundryOrderService;

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    public void purgeDeliveredPhotos() {
        Instant cutoff = Instant.now().minus(LaundryPhotoPolicy.RETENTION);
        List<LaundryOrderLine> due = lineRepository.findPhotosDue(cutoff);
        for (LaundryOrderLine line : due) {
            try {
                laundryOrderService.purgePhoto(line.getId());
            } catch (RuntimeException ex) {
                log.warn("Laundry photo {} was kept for a later retry", line.getPhotoMediaId());
            }
        }
    }
}
