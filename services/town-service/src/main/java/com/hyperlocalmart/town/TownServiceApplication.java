package com.hyperlocalmart.town;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"com.hyperlocalmart.town", "com.hyperlocalmart.common"})
public class TownServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(TownServiceApplication.class, args);
    }
}
