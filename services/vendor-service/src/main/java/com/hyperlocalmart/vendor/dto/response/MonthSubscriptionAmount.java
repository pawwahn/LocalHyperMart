package com.hyperlocalmart.vendor.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Subscription due for one month-end. Months with nothing due are omitted. */
public record MonthSubscriptionAmount(LocalDate periodEnd, BigDecimal amount) {
}
