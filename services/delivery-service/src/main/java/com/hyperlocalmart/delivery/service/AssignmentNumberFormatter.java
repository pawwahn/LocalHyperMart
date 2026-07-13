package com.hyperlocalmart.delivery.service;

public final class AssignmentNumberFormatter {

    private AssignmentNumberFormatter() {
    }

    public static String pickup(String subOrderNumber) {
        return subOrderNumber + "-TO-HUB";
    }

    public static String lastMile(String orderNumber) {
        return orderNumber + "-TO-BUYER";
    }
}
