package com.hyperlocalmart.town.scratch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.town.dto.request.UpdateTownConfigRequest;
import com.hyperlocalmart.town.dto.response.TownOperationalConfigResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ScratchServiceRulesPartialTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void readRule_infersPartialEnabledWhenFilterIsBothAndFlagMissing() {
        Map<String, Object> value = new LinkedHashMap<>();
        Map<String, Object> beauty = new LinkedHashMap<>();
        beauty.put("enabled", true);
        beauty.put("rewardMin", 10);
        beauty.put("rewardMax", 25);
        beauty.put("minOrderAmount", 500);
        beauty.put("prepayModeFilter", "BOTH");
        beauty.put("issueAfterRating", true);
        beauty.put("partialRewardMin", 10);
        beauty.put("partialRewardMax", 50);
        beauty.put("partialMinPrepayAmount", 499);
        value.put(ScratchServiceRules.MAP_KEY, Map.of(ScratchServiceKind.BEAUTY.name(), beauty));

        ScratchServiceRules.Rule rule = ScratchServiceRules.read(value).get(ScratchServiceKind.BEAUTY.name());
        assertThat(rule.partialPrepayEnabled()).isTrue();
    }

    @Test
    void readBoolValue_acceptsNumericOneFromJsonb() {
        Map<String, Object> value = new LinkedHashMap<>();
        Map<String, Object> beauty = new LinkedHashMap<>();
        beauty.put("enabled", true);
        beauty.put("rewardMin", 10);
        beauty.put("rewardMax", 200);
        beauty.put("minOrderAmount", 500);
        beauty.put("prepayModeFilter", "BOTH");
        beauty.put("issueAfterRating", true);
        beauty.put("partialPrepayEnabled", 1);
        beauty.put("partialRewardMin", 5);
        beauty.put("partialRewardMax", 80);
        beauty.put("partialMinPrepayAmount", 50);
        value.put(ScratchServiceRules.MAP_KEY, Map.of(ScratchServiceKind.BEAUTY.name(), beauty));

        ScratchServiceRules.Rule rule = ScratchServiceRules.read(value).get(ScratchServiceKind.BEAUTY.name());
        assertThat(rule.partialPrepayEnabled()).isTrue();
    }

    @Test
    void writeRead_roundTripsPartialPrepayEnabled() {
        Map<String, Object> value = new LinkedHashMap<>();
        ScratchServiceRules.Rule beauty = ScratchServiceRules.Rule.builder()
                .enabled(true)
                .rewardMin(new BigDecimal("10.00"))
                .rewardMax(new BigDecimal("200.00"))
                .minOrderAmount(new BigDecimal("500.00"))
                .prepayModeFilter(ScratchPrepayModeFilter.BOTH)
                .issueAfterRating(true)
                .partialPrepayEnabled(true)
                .partialRewardMin(new BigDecimal("5.00"))
                .partialRewardMax(new BigDecimal("80.00"))
                .partialMinPrepayAmount(new BigDecimal("50.00"))
                .build();
        ScratchServiceRules.write(value, Map.of(ScratchServiceKind.BEAUTY.name(), beauty));

        Map<String, ScratchServiceRules.Rule> read = ScratchServiceRules.read(value);
        ScratchServiceRules.Rule round = read.get(ScratchServiceKind.BEAUTY.name());
        assertThat(round.partialPrepayEnabled()).isTrue();
        assertThat(round.partialRewardMax()).isEqualByComparingTo("80.00");
    }

    @Test
    void jackson_deserializesPartialPrepayEnabledOnScratchRuleRequest() throws Exception {
        String json = """
                {
                  "scratchByService": {
                    "BEAUTY": {
                      "enabled": true,
                      "rewardMin": 10,
                      "rewardMax": 200,
                      "minOrderAmount": 500,
                      "prepayModeFilter": "BOTH",
                      "issueAfterRating": true,
                      "partialPrepayEnabled": true,
                      "partialRewardMin": 5,
                      "partialRewardMax": 80,
                      "partialMinPrepayAmount": 50
                    }
                  }
                }
                """;
        UpdateTownConfigRequest req = mapper.readValue(json, UpdateTownConfigRequest.class);
        Map<String, Object> beauty = req.getScratchByService().get("BEAUTY");
        assertThat(ScratchServiceRules.readBoolValue(beauty.get("partialPrepayEnabled"), false)).isTrue();
        assertThat(beauty.get("partialMinPrepayAmount")).isEqualTo(50);
    }

    @Test
    void jackson_serializesPartialPrepayEnabledWithExpectedKey() throws Exception {
        TownOperationalConfigResponse.ScratchServiceRuleResponse row =
                TownOperationalConfigResponse.ScratchServiceRuleResponse.builder()
                        .partialPrepayEnabled(true)
                        .build();
        String json = mapper.writeValueAsString(row);
        assertThat(json).contains("\"partialPrepayEnabled\":true");
    }
}
