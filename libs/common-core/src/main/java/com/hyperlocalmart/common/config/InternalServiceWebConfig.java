package com.hyperlocalmart.common.config;

import com.hyperlocalmart.common.security.InternalServiceAuthFilter;
import com.hyperlocalmart.common.security.InternalServiceAuthProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
@EnableConfigurationProperties(InternalServiceAuthProperties.class)
public class InternalServiceWebConfig {

    @Bean
    public FilterRegistrationBean<InternalServiceAuthFilter> internalServiceAuthFilter(
            InternalServiceAuthProperties properties) {
        FilterRegistrationBean<InternalServiceAuthFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new InternalServiceAuthFilter(properties));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }
}
