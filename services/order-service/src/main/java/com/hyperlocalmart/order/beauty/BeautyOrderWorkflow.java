package com.hyperlocalmart.order.beauty;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

public final class BeautyOrderWorkflow {

    private BeautyOrderWorkflow() {
    }

    public static BeautyOrderStatus next(BeautyVenue venue, BeautyOrderStatus status, BeautyMove move) {
        return switch (move) {
            case EN_ROUTE -> {
                require(venue == BeautyVenue.AT_HOME, "Travel updates apply to home visits");
                require(status == BeautyOrderStatus.CONFIRMED, "Start travel after the booking is confirmed");
                yield BeautyOrderStatus.EN_ROUTE;
            }
            case START -> {
                require(status == BeautyOrderStatus.CONFIRMED || status == BeautyOrderStatus.EN_ROUTE,
                        "Begin the session when the artist is ready");
                yield BeautyOrderStatus.IN_SERVICE;
            }
            case COMPLETE -> {
                require(status == BeautyOrderStatus.IN_SERVICE, "Complete after the session has started");
                yield BeautyOrderStatus.COMPLETED;
            }
            case CANCEL -> {
                require(status == BeautyOrderStatus.AWAITING_PAYMENT
                                || status == BeautyOrderStatus.CONFIRMED
                                || status == BeautyOrderStatus.EN_ROUTE,
                        "Cancel before the session starts");
                yield BeautyOrderStatus.CANCELLED;
            }
        };
    }

    private static void require(boolean ok, String message) {
        if (!ok) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }
}
