package com.hyperlocalmart.payment.job;

import com.hyperlocalmart.payment.entity.PaymentWebhookLog;
import com.hyperlocalmart.payment.repository.PaymentWebhookLogRepository;
import com.hyperlocalmart.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentWebhookRecoveryJob {

    private final PaymentWebhookLogRepository paymentWebhookLogRepository;
    private final PaymentService paymentService;

    @Scheduled(fixedDelayString = "${hyperlocalmart.payment.webhook-recovery.fixed-delay-ms:60000}")
    public void replayStuckWebhooks() {
        Instant cutoff = Instant.now().minusSeconds(30);
        List<PaymentWebhookLog> stuck = paymentWebhookLogRepository
                .findTop50BySignatureValidTrueAndProcessedFalseAndReceivedAtBeforeOrderByReceivedAtAsc(cutoff);
        if (stuck.isEmpty()) {
            return;
        }
        log.info("Replaying {} unprocessed webhook log(s)", stuck.size());
        for (PaymentWebhookLog row : stuck) {
            try {
                paymentService.replayWebhookLog(row);
            } catch (Exception ex) {
                log.warn("Webhook replay failed logId={} gateway={}", row.getId(), row.getGateway(), ex);
            }
        }
    }
}
