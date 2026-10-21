package com.hyperlocalmart.order.laundry;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.List;

public final class LaundryOrderWorkflow {

    private LaundryOrderWorkflow() {
    }

    public static LaundryOrderStatus next(
            LaundryLogistics logistics,
            LaundryOrderStatus status,
            LaundryMove move,
            int pickupRescheduleCount,
            boolean rewashUsed) {
        return switch (move) {
            case ACCEPT -> {
                require(status == LaundryOrderStatus.REQUESTED, "The shop can accept a new request");
                yield LaundryOrderStatus.ACCEPTED;
            }
            case SCHEDULE_PICKUP -> schedule(logistics, status, pickupRescheduleCount);
            case MARK_PICKED_UP -> {
                require(logistics != LaundryLogistics.DROP_ONLY, "This request has no pickup");
                require(status == LaundryOrderStatus.PICKUP_SCHEDULED || status == LaundryOrderStatus.ACCEPTED,
                        "Mark pickup after the order is placed");
                yield LaundryOrderStatus.PICKED_UP;
            }
            case MARK_RECEIVED -> {
                require(logistics == LaundryLogistics.DROP_ONLY, "Use pickup when the shop is collecting the clothes");
                require(status == LaundryOrderStatus.ACCEPTED, "Mark received after the shop accepts the drop-off");
                yield LaundryOrderStatus.AT_SHOP;
            }
            case START -> {
                require(status == LaundryOrderStatus.PICKED_UP || status == LaundryOrderStatus.AT_SHOP,
                        "Start processing after the clothes are at the shop");
                yield LaundryOrderStatus.IN_PROCESS;
            }
            case MARK_READY -> {
                require(status == LaundryOrderStatus.IN_PROCESS, "Mark ready while the clothes are in process");
                yield LaundryOrderStatus.READY;
            }
            case OUT_FOR_DROP -> {
                require(logistics != LaundryLogistics.PICKUP_ONLY, "The customer is collecting this order");
                require(status == LaundryOrderStatus.READY, "Send for drop when the clothes are ready");
                yield LaundryOrderStatus.OUT_FOR_DROP;
            }
            case DELIVER -> {
                if (logistics == LaundryLogistics.PICKUP_ONLY) {
                    require(status == LaundryOrderStatus.READY, "Hand over when the clothes are ready");
                } else {
                    require(status == LaundryOrderStatus.OUT_FOR_DROP, "Mark delivered when the clothes are out for drop");
                }
                yield LaundryOrderStatus.DELIVERED;
            }
            case CANCEL -> {
                require(status == LaundryOrderStatus.AWAITING_PAYMENT
                                || status == LaundryOrderStatus.REQUESTED
                                || status == LaundryOrderStatus.ACCEPTED
                                || status == LaundryOrderStatus.PICKUP_SCHEDULED,
                        "Cancel before the clothes are picked up");
                yield LaundryOrderStatus.CANCELLED;
            }
            case REWASH -> {
                require(!rewashUsed, "One rewash is included on this order");
                require(status == LaundryOrderStatus.READY || status == LaundryOrderStatus.DELIVERED,
                        "Rewash is available once the clothes are ready or delivered");
                yield LaundryOrderStatus.IN_PROCESS;
            }
        };
    }

    public static List<String> allowedMoves(
            LaundryLogistics logistics,
            LaundryOrderStatus status,
            int pickupRescheduleCount,
            boolean rewashUsed) {
        List<String> allowed = new ArrayList<>();
        for (LaundryMove move : LaundryMove.values()) {
            try {
                next(logistics, status, move, pickupRescheduleCount, rewashUsed);
                allowed.add(move.name());
            } catch (BusinessException ignored) {
                // Not valid from this status.
            }
        }
        return allowed;
    }

    public static boolean countsAsReschedule(LaundryOrderStatus status, LaundryMove move) {
        return move == LaundryMove.SCHEDULE_PICKUP && status == LaundryOrderStatus.PICKUP_SCHEDULED;
    }

    private static LaundryOrderStatus schedule(LaundryLogistics logistics, LaundryOrderStatus status, int pickupRescheduleCount) {
        require(logistics != LaundryLogistics.DROP_ONLY, "This request has no pickup");
        if (status == LaundryOrderStatus.ACCEPTED) {
            return LaundryOrderStatus.PICKUP_SCHEDULED;
        }
        require(status == LaundryOrderStatus.PICKUP_SCHEDULED, "Schedule pickup after the shop accepts");
        require(pickupRescheduleCount < 1, "Pickup can be rescheduled once");
        return LaundryOrderStatus.PICKUP_SCHEDULED;
    }

    private static void require(boolean ok, String message) {
        if (!ok) {
            throw new BusinessException(ErrorCode.CONFLICT, message);
        }
    }
}
