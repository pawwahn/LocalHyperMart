package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.util.DisplayNames;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.VendorClient;
import com.hyperlocalmart.payment.entity.Settlement;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayeeDisplayNameService {

    private final DeliveryClient deliveryClient;
    private final VendorClient vendorClient;

    public String forSettlement(Settlement settlement) {
        if (settlement == null) {
            return "Payee";
        }
        String stored = settlement.getPayeeName();
        if (DisplayNames.isHumanLabel(stored)) {
            return stored.trim();
        }
        UUID payeeId = settlement.getPayeeId();
        if (payeeId == null) {
            return roleFallback(settlement.getPayeeType());
        }
        return switch (settlement.getPayeeType()) {
            case VENDOR -> resolveVendor(payeeId);
            case AGENT -> resolveAgent(payeeId);
            default -> resolveHub(payeeId);
        };
    }

    public String forHub(UUID hubId) {
        if (hubId == null) {
            return "Delivery hub";
        }
        return resolveHub(hubId);
    }

    private final Map<UUID, String> hubCache = new HashMap<>();
    private final Map<UUID, String> vendorCache = new HashMap<>();
    private final Map<UUID, String> agentCache = new HashMap<>();

    private String resolveHub(UUID hubId) {
        return hubCache.computeIfAbsent(hubId, id -> {
            try {
                String name = deliveryClient.getHubDisplayName(id);
                if (DisplayNames.isHumanLabel(name)) {
                    return name.trim();
                }
            } catch (Exception ex) {
                log.debug("Could not resolve hub name for {}", id);
            }
            return "Delivery hub";
        });
    }

    private String resolveVendor(UUID vendorId) {
        return vendorCache.computeIfAbsent(vendorId, id -> {
            try {
                String name = vendorClient.getVendorShopDisplayName(id);
                if (DisplayNames.isHumanLabel(name)) {
                    return name.trim();
                }
            } catch (Exception ex) {
                log.debug("Could not resolve vendor shop name for {}", id);
            }
            return "Vendor";
        });
    }

    private String resolveAgent(UUID agentId) {
        return agentCache.computeIfAbsent(agentId, id -> {
            try {
                String name = deliveryClient.getAgentDisplayName(id);
                if (DisplayNames.isHumanLabel(name)) {
                    return name.trim();
                }
            } catch (Exception ex) {
                log.debug("Could not resolve agent name for {}", id);
            }
            return "Delivery agent";
        });
    }

    private static String roleFallback(SettlementPayeeType type) {
        if (type == SettlementPayeeType.VENDOR) {
            return "Vendor";
        }
        if (type == SettlementPayeeType.AGENT) {
            return "Delivery agent";
        }
        return "Delivery hub";
    }
}
