package com.hyperlocalmart.order.diagnostics;

import com.hyperlocalmart.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DiagnosticsOrderWorkflowTest {

    @Test
    void visitConfirmsPatientBeforeSamples() {
        DiagnosticsOrderStatus status = DiagnosticsOrderStatus.ASSIGNED;
        status = DiagnosticsOrderWorkflow.next(status, DiagnosticsMove.START_COLLECTION);
        assertEquals(DiagnosticsOrderStatus.COLLECTION_IN_PROGRESS, status);
        status = DiagnosticsOrderWorkflow.next(status, DiagnosticsMove.REACH_PATIENT);
        assertEquals(DiagnosticsOrderStatus.REACHED_PATIENT, status);
        status = DiagnosticsOrderWorkflow.next(status, DiagnosticsMove.CONFIRM_PATIENT);
        assertEquals(DiagnosticsOrderStatus.PATIENT_CONFIRMED, status);
        status = DiagnosticsOrderWorkflow.next(status, DiagnosticsMove.SAMPLES_COLLECTED);
        assertEquals(DiagnosticsOrderStatus.SAMPLES_COLLECTED, status);
    }

    @Test
    void cannotCollectOrReceiveBeforeNameConfirm() {
        assertThrows(BusinessException.class, () -> DiagnosticsOrderWorkflow.next(
                DiagnosticsOrderStatus.COLLECTION_IN_PROGRESS, DiagnosticsMove.SAMPLES_COLLECTED));
        assertThrows(BusinessException.class, () -> DiagnosticsOrderWorkflow.next(
                DiagnosticsOrderStatus.REACHED_PATIENT, DiagnosticsMove.SAMPLES_COLLECTED));
        assertThrows(BusinessException.class, () -> DiagnosticsOrderWorkflow.next(
                DiagnosticsOrderStatus.COLLECTION_IN_PROGRESS, DiagnosticsMove.RECEIVED_AT_LAB));
        assertEquals(
                DiagnosticsOrderStatus.RECEIVED_AT_LAB,
                DiagnosticsOrderWorkflow.next(DiagnosticsOrderStatus.SAMPLES_COLLECTED, DiagnosticsMove.RECEIVED_AT_LAB));
    }

    @Test
    void setReportEtaAdvancesFromReceivedAtLabAndCanBeUpdatedLater() {
        assertEquals(
                DiagnosticsOrderStatus.REPORT_ETA_SET,
                DiagnosticsOrderWorkflow.next(DiagnosticsOrderStatus.RECEIVED_AT_LAB, DiagnosticsMove.SET_REPORT_ETA));
        assertEquals(
                DiagnosticsOrderStatus.REPORT_ETA_SET,
                DiagnosticsOrderWorkflow.next(DiagnosticsOrderStatus.REPORT_ETA_SET, DiagnosticsMove.SET_REPORT_ETA));
        assertEquals(
                DiagnosticsOrderStatus.REPORT_IN_PROGRESS,
                DiagnosticsOrderWorkflow.next(DiagnosticsOrderStatus.REPORT_IN_PROGRESS, DiagnosticsMove.SET_REPORT_ETA));
    }
}
