package com.hyperlocalmart.order.diagnostics;

public enum DiagnosticsOrderStatus {
    AWAITING_PAYMENT,
    BOOKED,
    ASSIGNED,
    COLLECTION_IN_PROGRESS,
    REACHED_PATIENT,
    PATIENT_CONFIRMED,
    SAMPLES_COLLECTED,
    RECEIVED_AT_LAB,
    REPORT_ETA_SET,
    REPORT_IN_PROGRESS,
    REPORT_FINALIZED,
    COMPLETED,
    CANCELLED,
    NO_SHOW,
    COLLECTION_FAILED,
    RETEST_REQUIRED;

    public String label() {
        return switch (this) {
            case AWAITING_PAYMENT -> "Awaiting payment";
            case BOOKED -> "Booked";
            case ASSIGNED -> "Agent assigned";
            case COLLECTION_IN_PROGRESS -> "On the way";
            case REACHED_PATIENT -> "Reached patient";
            case PATIENT_CONFIRMED -> "Collecting samples";
            case SAMPLES_COLLECTED -> "Samples collected";
            case RECEIVED_AT_LAB -> "Received at lab";
            case REPORT_ETA_SET -> "Report ETA set";
            case REPORT_IN_PROGRESS -> "Report in progress";
            case REPORT_FINALIZED -> "Report finalized";
            case COMPLETED -> "Completed";
            case CANCELLED -> "Cancelled";
            case NO_SHOW -> "No show";
            case COLLECTION_FAILED -> "Collection failed";
            case RETEST_REQUIRED -> "Retest required";
        };
    }

    /** Visit started, not yet bagged — one of these at a time per collector. */
    public boolean isOpenFieldVisit() {
        return this == COLLECTION_IN_PROGRESS
                || this == REACHED_PATIENT
                || this == PATIENT_CONFIRMED;
    }
}
