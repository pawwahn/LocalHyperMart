package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.PaymentAdmissionProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
public class PaymentAdmissionService {

    private static final DefaultRedisScript<Long> ADMIT_SCRIPT = new DefaultRedisScript<>(
            """
                    local current = redis.call('INCR', KEYS[1])
                    if current == 1 then
                      redis.call('EXPIRE', KEYS[1], ARGV[2])
                    end
                    if current > tonumber(ARGV[1]) then
                      redis.call('DECR', KEYS[1])
                      return 0
                    end
                    return 1
                    """,
            Long.class);

    private final PaymentAdmissionProperties properties;
    private final StringRedisTemplate redisTemplate;
    private final boolean redisAdmission;

    private final AtomicLong localWindowSecond = new AtomicLong(-1L);
    private final AtomicInteger localWindowCount = new AtomicInteger(0);

    public PaymentAdmissionService(
            PaymentAdmissionProperties properties,
            ObjectProvider<StringRedisTemplate> redisTemplate,
            Environment environment) {
        this.properties = properties;
        String redisHost = environment.getProperty("spring.data.redis.host", "");
        this.redisAdmission = StringUtils.hasText(redisHost);
        this.redisTemplate = redisAdmission ? redisTemplate.getIfAvailable() : null;
    }

    /**
     * Blocks until a new-initiate slot is available or {@link PaymentAdmissionProperties#getMaxWaitMs()} elapses.
     * Idempotent retries should not call this.
     */
    public void awaitInitiateSlot() {
        if (!properties.isEnabled()) {
            return;
        }
        long deadlineNanos = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(properties.getMaxWaitMs());
        do {
            if (tryAcquireOne()) {
                return;
            }
            if (System.nanoTime() >= deadlineNanos) {
                break;
            }
            sleepQuietly(properties.getRetryIntervalMs());
        } while (System.nanoTime() < deadlineNanos);
        throw new BusinessException(
                ErrorCode.RATE_LIMITED,
                "Payments are in high demand. Please wait a moment and try again.");
    }

    private boolean tryAcquireOne() {
        if (redisAdmission && redisTemplate != null) {
            return tryAcquireRedis(redisTemplate);
        }
        return tryAcquireLocal();
    }

    private boolean tryAcquireRedis(StringRedisTemplate redis) {
        long second = Instant.now().getEpochSecond();
        String key = properties.getRedisKeyPrefix() + ":" + second;
        int limit = Math.max(1, properties.getMaxPerSecond());
        try {
            Long allowed = redis.execute(
                    ADMIT_SCRIPT,
                    List.of(key),
                    String.valueOf(limit),
                    "2");
            return allowed != null && allowed == 1L;
        } catch (Exception ex) {
            log.warn("Payment admission Redis error (failOpen={})", properties.isFailOpenOnRedisError(), ex);
            if (properties.isFailOpenOnRedisError()) {
                return true;
            }
            return false;
        }
    }

    private boolean tryAcquireLocal() {
        long second = Instant.now().getEpochSecond();
        long window = localWindowSecond.get();
        if (window != second) {
            localWindowSecond.set(second);
            localWindowCount.set(0);
        }
        int limit = Math.max(1, properties.getMaxPerSecond());
        return localWindowCount.incrementAndGet() <= limit;
    }

    private static void sleepQuietly(long ms) {
        if (ms <= 0) {
            return;
        }
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }
}
