package com.hyperlocalmart.payment.settlement;

import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.dto.response.SettlementCandidateView;

/** Per-order piece count for commercial terms (diagnostics = 1 booking per DX order). */
public final class SettlementPieceCount {

    private SettlementPieceCount() {
    }

    public static Integer forCandidateView(SettlementCandidateView.Item item) {
        if (item == null) {
            return null;
        }
        Integer pieces = item.getPieceCount();
        if (pieces != null && pieces > 0) {
            return pieces;
        }
        if (isDiagnostics(item.getOrderNumber())) {
            return 1;
        }
        return pieces;
    }

    public static Integer forOrderItem(OrderClient.SettlementCandidateItem item) {
        if (item == null) {
            return null;
        }
        Integer pieces = item.pieceCount();
        if (pieces != null && pieces > 0) {
            return pieces;
        }
        if (isDiagnostics(item.orderNumber())) {
            return 1;
        }
        return pieces;
    }

    private static boolean isDiagnostics(String orderNumber) {
        return orderNumber != null && orderNumber.startsWith("DX");
    }
}
