package com.hyperlocalmart.order.diagnostics;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

public final class DiagnosticsOrderWorkflow {

    private DiagnosticsOrderWorkflow() {
    }

    public static DiagnosticsOrderStatus next(DiagnosticsOrderStatus status, DiagnosticsMove move) {
        return switch (move) {
            case ASSIGN -> {
                require(
                        status == DiagnosticsOrderStatus.BOOKED
                                || status == DiagnosticsOrderStatus.ASSIGNED
                                || status.isOpenFieldVisit(),
                        "Reassign only while collection is in progress at the patient's place (not after samples reach the lab)");
                yield switch (status) {
                    case BOOKED -> DiagnosticsOrderStatus.ASSIGNED;
                    case ASSIGNED, COLLECTION_IN_PROGRESS, REACHED_PATIENT, PATIENT_CONFIRMED -> status;
                    default -> throw new IllegalStateException("unreachable");
                };
            }
            case START_COLLECTION -> {
                require(status == DiagnosticsOrderStatus.ASSIGNED, "Start collection after assignment");
                yield DiagnosticsOrderStatus.COLLECTION_IN_PROGRESS;
            }
            case REACH_PATIENT -> {
                require(status == DiagnosticsOrderStatus.COLLECTION_IN_PROGRESS, "Mark reached after the visit starts");
                yield DiagnosticsOrderStatus.REACHED_PATIENT;
            }
            case CONFIRM_PATIENT -> {
                require(status == DiagnosticsOrderStatus.REACHED_PATIENT, "Confirm the patient name before collecting");
                yield DiagnosticsOrderStatus.PATIENT_CONFIRMED;
            }
            case SAMPLES_COLLECTED -> {
                require(status == DiagnosticsOrderStatus.PATIENT_CONFIRMED,
                        "Collect samples only after the patient name is confirmed");
                yield DiagnosticsOrderStatus.SAMPLES_COLLECTED;
            }
            case MARK_COD_RECEIVED -> status;
            case RECEIVED_AT_LAB -> {
                require(status == DiagnosticsOrderStatus.SAMPLES_COLLECTED,
                        "Receive sample at lab after collection");
                yield DiagnosticsOrderStatus.RECEIVED_AT_LAB;
            }
            case SET_REPORT_ETA -> {
                require(status == DiagnosticsOrderStatus.RECEIVED_AT_LAB
                                || status == DiagnosticsOrderStatus.REPORT_ETA_SET
                                || status == DiagnosticsOrderStatus.REPORT_IN_PROGRESS,
                        "Set report ETA after sample is at lab");
                yield status == DiagnosticsOrderStatus.RECEIVED_AT_LAB
                        ? DiagnosticsOrderStatus.REPORT_ETA_SET
                        : status;
            }
            case UPDATE_RESULTS -> {
                require(status == DiagnosticsOrderStatus.RECEIVED_AT_LAB
                                || status == DiagnosticsOrderStatus.REPORT_ETA_SET
                                || status == DiagnosticsOrderStatus.REPORT_IN_PROGRESS,
                        "Enter results when sample is at lab");
                yield DiagnosticsOrderStatus.REPORT_IN_PROGRESS;
            }
            case FINALIZE -> {
                require(status == DiagnosticsOrderStatus.REPORT_IN_PROGRESS
                                || status == DiagnosticsOrderStatus.REPORT_ETA_SET,
                        "Finalize after results are in progress");
                yield DiagnosticsOrderStatus.REPORT_FINALIZED;
            }
            case REOPEN -> {
                require(status == DiagnosticsOrderStatus.REPORT_FINALIZED, "Reopen only finalized reports");
                yield DiagnosticsOrderStatus.REPORT_IN_PROGRESS;
            }
            case COMPLETE -> {
                require(status == DiagnosticsOrderStatus.REPORT_FINALIZED, "Complete after report is finalized");
                yield DiagnosticsOrderStatus.COMPLETED;
            }
            case CANCEL -> {
                require(status == DiagnosticsOrderStatus.AWAITING_PAYMENT
                                || status == DiagnosticsOrderStatus.BOOKED,
                        "Cancel before collection is assigned");
                yield DiagnosticsOrderStatus.CANCELLED;
            }
            case NO_SHOW -> {
                require(status == DiagnosticsOrderStatus.ASSIGNED || status.isOpenFieldVisit(),
                        "No-show applies to scheduled visits");
                yield DiagnosticsOrderStatus.NO_SHOW;
            }
            case COLLECTION_FAILED -> {
                require(status != DiagnosticsOrderStatus.CANCELLED
                                && status != DiagnosticsOrderStatus.COMPLETED,
                        "Collection failed cannot apply to closed orders");
                yield DiagnosticsOrderStatus.COLLECTION_FAILED;
            }
        };
    }

    private static void require(boolean ok, String message) {
        if (!ok) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }
}
