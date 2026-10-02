package com.hyperlocalmart.catalog.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "hyperlocalmart.cache.catalog-browse")
public class CatalogCacheProperties {

    private boolean enabled = false;

    /** Redis entry TTL for browse/search pages. */
    private long ttlSeconds = 45;
}
