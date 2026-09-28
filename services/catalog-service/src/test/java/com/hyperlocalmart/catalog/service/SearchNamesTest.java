package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SearchNamesTest {

    @Test
    void normalize_splitsTrimsAndDropsDuplicates() {
        assertThat(SearchNames.normalize(" green label bru, bru coffee , green label bru "))
                .isEqualTo("green label bru, bru coffee");
    }

    @Test
    void normalize_blankClearsTheField() {
        assertThat(SearchNames.normalize(null)).isNull();
        assertThat(SearchNames.normalize("  ,  , ")).isNull();
    }

    @Test
    void normalize_rejectsValuesLongerThanTheColumn() {
        String raw = "a".repeat(501);
        assertThatThrownBy(() -> SearchNames.normalize(raw))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("500");
    }
}
