package com.hyperlocalmart.payment.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.api.ApiResponse;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TownClientDeserializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void vendorAgentDeliveryConfig_deserializesFromTownApiShape() throws Exception {
        String json = """
                {
                  "success": true,
                  "data": {
                    "enabled": true,
                    "vendorAgentPayoutAmount": 11.0,
                    "hubPayoutAmount": 5.0
                  }
                }
                """;
        var type = mapper.getTypeFactory().constructParametricType(
                ApiResponse.class, TownClient.VendorAgentDeliveryConfig.class);
        @SuppressWarnings("unchecked")
        ApiResponse<TownClient.VendorAgentDeliveryConfig> response =
                (ApiResponse<TownClient.VendorAgentDeliveryConfig>) mapper.readValue(json, type);
        assertThat(response.getData()).isNotNull();
        assertThat(response.getData().enabled()).isTrue();
        assertThat(response.getData().vendorAgentPayoutAmount()).isEqualByComparingTo("11");
    }
}
