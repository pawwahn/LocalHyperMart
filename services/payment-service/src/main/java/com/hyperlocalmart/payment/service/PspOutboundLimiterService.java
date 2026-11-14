package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.PspOutboundLimiterProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

@Service
public class PspOutboundLimiterService {

    private final PspOutboundLimiterProperties properties;
    private Semaphore semaphore;

    public PspOutboundLimiterService(PspOutboundLimiterProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void init() {
        int permits = Math.max(1, properties.getMaxConcurrent());
        semaphore = new Semaphore(permits, true);
    }

    public void runWithPermit(Runnable action) {
        if (!properties.isEnabled()) {
            action.run();
            return;
        }
        boolean acquired = false;
        try {
            acquired = semaphore.tryAcquire(properties.getMaxWaitMs(), TimeUnit.MILLISECONDS);
            if (!acquired) {
                throw new BusinessException(
                        ErrorCode.RATE_LIMITED,
                        "Payment gateway is busy. Please try again in a moment.");
            }
            action.run();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.RATE_LIMITED, "Payment request interrupted");
        } finally {
            if (acquired) {
                semaphore.release();
            }
        }
    }
}
