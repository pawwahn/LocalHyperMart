package com.hyperlocalmart.vendor.entity;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class VendorServiceForConverterTest {

    private final VendorServiceForConverter converter = new VendorServiceForConverter();

    @Test
    void labTypesPersistWithShortDbCodes() {
        assertEquals("PRIV_LAB", converter.convertToDatabaseColumn(VendorServiceFor.PRIVATE_LAB));
        assertEquals("HOSP_LAB", converter.convertToDatabaseColumn(VendorServiceFor.HOSPITAL_LAB));
        assertEquals(VendorServiceFor.PRIVATE_LAB, converter.convertToEntityAttribute("PRIV_LAB"));
        assertEquals(VendorServiceFor.HOSPITAL_LAB, converter.convertToEntityAttribute("HOSP_LAB"));
    }

    @Test
    void legacyBeautyValuesUnchanged() {
        assertEquals("UNISEX", converter.convertToDatabaseColumn(VendorServiceFor.UNISEX));
        assertEquals(VendorServiceFor.FEMALE, converter.convertToEntityAttribute("FEMALE"));
    }

    @Test
    void truncatedLegacyCodesMapSafely() {
        assertEquals(VendorServiceFor.PRIVATE_LAB, converter.convertToEntityAttribute("PRIVATE_LA"));
        assertEquals(VendorServiceFor.HOSPITAL_LAB, converter.convertToEntityAttribute("HOSPITAL_LA"));
        assertEquals(VendorServiceFor.UNISEX, converter.convertToEntityAttribute("NOT_A_REAL_CODE"));
    }
}
