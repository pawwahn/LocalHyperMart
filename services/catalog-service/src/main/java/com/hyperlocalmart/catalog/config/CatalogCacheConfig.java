package com.hyperlocalmart.catalog.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;

@Configuration
@EnableCaching
public class CatalogCacheConfig {

    @Bean
    @ConditionalOnProperty(prefix = "hyperlocalmart.cache.catalog-browse", name = "enabled", havingValue = "true")
    RedisCacheManager catalogBrowseCacheManager(
            RedisConnectionFactory connectionFactory, CatalogCacheProperties properties) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(Math.max(5, properties.getTtlSeconds())))
                .disableCachingNullValues();
        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "hyperlocalmart.cache.catalog-browse", name = "enabled", havingValue = "false", matchIfMissing = true)
    CacheManager catalogBrowseCacheDisabled() {
        return new NoOpCacheManager();
    }
}
