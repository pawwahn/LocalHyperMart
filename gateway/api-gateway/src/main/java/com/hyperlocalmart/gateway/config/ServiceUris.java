package com.hyperlocalmart.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "hyperlocalmart.services")
public class ServiceUris {

    private String user = "http://localhost:8081";
    private String town = "http://localhost:8082";
    private String vendor = "http://localhost:8083";
    private String catalog = "http://localhost:8084";
    private String cart = "http://localhost:8085";
    private String order = "http://localhost:8086";
    private String payment = "http://localhost:8087";
    private String delivery = "http://localhost:8088";
    private String notification = "http://localhost:8089";
    private String billing = "http://localhost:8090";
    private String media = "http://localhost:8091";
    private String reporting = "http://localhost:8092";

    public String getUser() { return user; }
    public void setUser(String user) { this.user = user; }
    public String getTown() { return town; }
    public void setTown(String town) { this.town = town; }
    public String getVendor() { return vendor; }
    public void setVendor(String vendor) { this.vendor = vendor; }
    public String getCatalog() { return catalog; }
    public void setCatalog(String catalog) { this.catalog = catalog; }
    public String getCart() { return cart; }
    public void setCart(String cart) { this.cart = cart; }
    public String getOrder() { return order; }
    public void setOrder(String order) { this.order = order; }
    public String getPayment() { return payment; }
    public void setPayment(String payment) { this.payment = payment; }
    public String getDelivery() { return delivery; }
    public void setDelivery(String delivery) { this.delivery = delivery; }
    public String getNotification() { return notification; }
    public void setNotification(String notification) { this.notification = notification; }
    public String getBilling() { return billing; }
    public void setBilling(String billing) { this.billing = billing; }
    public String getMedia() { return media; }
    public void setMedia(String media) { this.media = media; }
    public String getReporting() { return reporting; }
    public void setReporting(String reporting) { this.reporting = reporting; }
}
