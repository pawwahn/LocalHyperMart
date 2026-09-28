package com.hyperlocalmart.catalog.audit;

import com.hyperlocalmart.catalog.entity.Category;
import com.hyperlocalmart.catalog.entity.MasterItem;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

public final class CatalogAuditSnapshots {

    private CatalogAuditSnapshots() {}

    public static Map<String, Object> masterItem(MasterItem item) {
        if (item == null) {
            return Map.of();
        }
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("name", item.getName());
        map.put("searchNames", item.getSearchNames());
        map.put("description", item.getDescription());
        map.put("categoryName", item.getCategory() != null ? item.getCategory().getName() : null);
        map.put("unitCode", item.getUnit() != null ? item.getUnit().getCode() : null);
        map.put("mrp", decimal(item.getMrp()));
        map.put("hsnCode", item.getHsnCode());
        map.put("gstPercent", decimal(item.getGstPercent()));
        map.put("cessPercent", decimal(item.getCessPercent()));
        map.put("priceIncludesTax", item.isPriceIncludesTax());
        map.put("countryOfOrigin", item.getCountryOfOrigin());
        return map;
    }

    public static Map<String, Object> category(Category category) {
        if (category == null) {
            return Map.of();
        }
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("name", category.getName());
        map.put("description", category.getDescription());
        return map;
    }

    private static Object decimal(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.stripTrailingZeros();
    }
}
