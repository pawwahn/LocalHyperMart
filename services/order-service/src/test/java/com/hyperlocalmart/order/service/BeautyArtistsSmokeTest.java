package com.hyperlocalmart.order.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

@SpringBootTest
class BeautyArtistsSmokeTest {

    private static final UUID CHIRALA = UUID.fromString("a8e7366c-2bd8-4376-b18b-7ba110f4d69f");

    @Autowired
    BeautyOrderService beautyOrderService;

    @Test
    void loadsArtistsForChirala() {
        beautyOrderService.artists(CHIRALA);
    }
}
