package com.hyperlocalmart.catalog.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Browse cache is shared by town. Listing and category writes clear it after
 * commit so a price or photo change is not stuck behind the TTL.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CatalogBrowseCache {

    public static final String CACHE_NAME = "catalogBrowse";

    private final CacheManager cacheManager;

    public void evictAll() {
        if (TransactionSynchronizationManager.isSynchronizationActive()
                && TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    clear();
                }
            });
            return;
        }
        clear();
    }

    private void clear() {
        try {
            Cache cache = cacheManager.getCache(CACHE_NAME);
            if (cache != null) {
                cache.clear();
            }
        } catch (Exception ex) {
            log.warn("Could not clear catalog browse cache: {}", ex.getMessage());
        }
    }
}
