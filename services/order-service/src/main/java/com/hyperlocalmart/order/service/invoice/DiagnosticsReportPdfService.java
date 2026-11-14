package com.hyperlocalmart.order.service.invoice;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus;
import com.hyperlocalmart.order.entity.DiagnosticsOrder;
import com.hyperlocalmart.order.entity.DiagnosticsOrderLine;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
public class DiagnosticsReportPdfService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", Locale.ENGLISH);
    private static final Font TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
    private static final Font HEAD = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
    private static final Font BODY = FontFactory.getFont(FontFactory.HELVETICA, 9);
    private static final Font FOOT = FontFactory.getFont(FontFactory.HELVETICA, 7, Font.NORMAL, Color.DARK_GRAY);

    public byte[] generate(DiagnosticsOrder order, List<DiagnosticsOrderLine> lines) {
        if (order.getStatus() != DiagnosticsOrderStatus.REPORT_FINALIZED
                && order.getStatus() != DiagnosticsOrderStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Report is not finalized yet");
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(order.getShopName(), TITLE));
            doc.add(new Paragraph("Diagnostics report", HEAD));
            doc.add(spacer(8));
            doc.add(line("Order", order.getOrderNumber()));
            doc.add(line("Patient", order.getPatientName()));
            doc.add(line("Reference", formatReference(order)));
            doc.add(line("Sample collected", formatInstant(order.getSlotStart())));
            if (order.getReportFinalizedAt() != null) {
                doc.add(line("Report date", formatInstant(order.getReportFinalizedAt())));
            }
            doc.add(spacer(12));
            PdfPTable table = new PdfPTable(new float[] {3f, 2f, 1.5f, 2f});
            table.setWidthPercentage(100);
            header(table, "Test");
            header(table, "Result");
            header(table, "Unit");
            header(table, "Ref. range");
            for (DiagnosticsOrderLine line : lines) {
                cell(table, line.getTestName());
                cell(table, blank(line.getResultValue()));
                cell(table, blank(line.getResultUnit()));
                cell(table, blank(line.getReferenceRange()));
            }
            doc.add(table);
            doc.add(spacer(16));
            doc.add(new Paragraph(
                    "KoyaKart helps you book sample collection and view reports shared by your lab. "
                            + "KoyaKart is not a diagnostic lab and does not provide medical advice.",
                    FOOT));
            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            log.error("Failed diagnostics PDF for order {}", order.getId(), ex);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not generate report PDF");
        }
    }

    private static String formatReference(DiagnosticsOrder order) {
        if ("DOCTOR".equalsIgnoreCase(order.getReferenceType())) {
            return "Dr. " + blank(order.getReferringDoctorName());
        }
        return "Self / Walk-in";
    }

    private static String formatInstant(java.time.Instant instant) {
        if (instant == null) {
            return "—";
        }
        return DT.format(instant.atZone(IST));
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? "—" : s.trim();
    }

    private static Paragraph line(String label, String value) {
        return new Paragraph(label + ": " + value, BODY);
    }

    private static Paragraph spacer(float pt) {
        Paragraph p = new Paragraph(" ");
        p.setSpacingAfter(pt);
        return p;
    }

    private static void header(PdfPTable table, String text) {
        PdfPCell c = new PdfPCell(new Phrase(text, HEAD));
        c.setBackgroundColor(new Color(240, 248, 242));
        c.setPadding(6);
        table.addCell(c);
    }

    private static void cell(PdfPTable table, String text) {
        PdfPCell c = new PdfPCell(new Phrase(text, BODY));
        c.setPadding(5);
        table.addCell(c);
    }
}
