package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.config.WebhookQueueProperties;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class PaymentWebhookQueueService {

    private final WebhookQueueProperties properties;
    private final PaymentService paymentService;

    public PaymentWebhookQueueService(
            WebhookQueueProperties properties,
            @Lazy PaymentService paymentService) {
        this.properties = properties;
        this.paymentService = paymentService;
    }
    private volatile ExecutorService executor;

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public void enqueueRazorpay(UUID logId, String rawBody) {
        submit("razorpay", logId, () -> paymentService.processRazorpayWebhookByLogId(logId, rawBody));
    }

    public void enqueueCashfree(UUID logId, String rawBody, String timestamp, String signature) {
        submit("cashfree", logId, () -> paymentService.processCashfreeWebhookByLogId(logId, rawBody, timestamp, signature));
    }

    public void enqueuePhonePe(UUID logId, String rawBody, String authorization) {
        submit("phonepe", logId, () -> paymentService.processPhonePeWebhookByLogId(logId, rawBody, authorization));
    }

    private void submit(String gateway, UUID logId, Runnable task) {
        executor().submit(() -> {
            try {
                task.run();
            } catch (Exception ex) {
                log.warn("Webhook worker failed gateway={} logId={}", gateway, logId, ex);
            }
        });
    }

    private ExecutorService executor() {
        ExecutorService local = executor;
        if (local == null) {
            synchronized (this) {
                local = executor;
                if (local == null) {
                    int workers = Math.max(1, properties.getMaxConcurrent());
                    int capacity = Math.max(workers, properties.getQueueCapacity());
                    local = new ThreadPoolExecutor(
                            workers,
                            workers,
                            60L,
                            TimeUnit.SECONDS,
                            new ArrayBlockingQueue<>(capacity),
                            r -> {
                                Thread t = new Thread(r, "payment-webhook");
                                t.setDaemon(true);
                                return t;
                            },
                            new ThreadPoolExecutor.CallerRunsPolicy());
                    executor = local;
                }
            }
        }
        return local;
    }

    @PreDestroy
    void shutdown() {
        ExecutorService local = executor;
        if (local == null) {
            return;
        }
        local.shutdown();
        try {
            if (!local.awaitTermination(10, TimeUnit.SECONDS)) {
                local.shutdownNow();
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            local.shutdownNow();
        }
    }
}
