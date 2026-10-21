package com.hyperlocalmart.catalog.config;

import com.hyperlocalmart.catalog.service.CatalogBrowseCache;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.interceptor.LoggingCacheErrorHandler;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;

@Configuration
@EnableCaching
public class CatalogCacheConfig implements CachingConfigurer {

    /**
     * Redis is best-effort. A down cache must not fail catalog browse; the
     * request continues against Postgres.
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new LoggingCacheErrorHandler(false);
    }

    @Bean
    @ConditionalOnProperty(prefix = "hyperlocalmart.cache.catalog-browse", name = "enabled", havingValue = "true")
    RedisCacheManager catalogBrowseCacheManager(
            RedisConnectionFactory connectionFactory, CatalogCacheProperties properties) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(Math.max(5, properties.getTtlSeconds())))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(
                        new GenericJackson2JsonRedisSerializer()))
                .disableCachingNullValues();
        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .initialCacheNames(java.util.Set.of(CatalogBrowseCache.CACHE_NAME))
                .build();
    }

    @Bean
    @ConditionalOnProperty(
            prefix = "hyperlocalmart.cache.catalog-browse",
            name = "enabled",
            havingValue = "false",
            matchIfMissing = true)
    CacheManager catalogBrowseCacheDisabled() {
        return new NoOpCacheManager();
    }
}
