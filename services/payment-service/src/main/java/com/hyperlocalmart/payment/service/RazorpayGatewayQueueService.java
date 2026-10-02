package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.config.RazorpayQueueProperties;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class RazorpayGatewayQueueService {

    private final RazorpayQueueProperties properties;
    private final ExecutorService executor;
    private final Set<UUID> orderPaymentsInFlight = ConcurrentHashMap.newKeySet();
    private final Set<UUID> membershipPurchasesInFlight = ConcurrentHashMap.newKeySet();

    public RazorpayGatewayQueueService(RazorpayQueueProperties properties) {
        this.properties = properties;
        int workers = Math.max(1, properties.getMaxConcurrent());
        int capacity = Math.max(workers, properties.getQueueCapacity());
        this.executor = new ThreadPoolExecutor(
                workers,
                workers,
                60L,
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(capacity),
                r -> {
                    Thread t = new Thread(r, "razorpay-gateway");
                    t.setDaemon(true);
                    return t;
                },
                new ThreadPoolExecutor.CallerRunsPolicy());
    }

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public void enqueueOrderPayment(UUID paymentId, Runnable task) {
        enqueue(orderPaymentsInFlight, paymentId, task);
    }

    public void enqueueMembershipPurchase(UUID purchaseId, Runnable task) {
        enqueue(membershipPurchasesInFlight, purchaseId, task);
    }

    private void enqueue(Set<UUID> inFlight, UUID id, Runnable task) {
        if (!inFlight.add(id)) {
            return;
        }
        executor.submit(() -> {
            try {
                task.run();
            } catch (Exception ex) {
                log.warn("Razorpay gateway task failed for {}", id, ex);
            } finally {
                inFlight.remove(id);
            }
        });
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            executor.shutdownNow();
        }
    }
}
