package com.hyperlocalmart.order.service.invoice;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Service
public class InvoicePdfService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", Locale.ENGLISH);
    private static final Font TITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
    private static final Font HEADING_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
    private static final Font BODY_FONT = FontFactory.getFont(FontFactory.HELVETICA, 9);
    private static final Font SMALL_FONT = FontFactory.getFont(FontFactory.HELVETICA, 8, Font.NORMAL, Color.DARK_GRAY);

    public byte[] generate(InvoiceDocument invoice) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, output);
            document.open();

            document.add(new Paragraph("HyperLocalMart", TITLE_FONT));
            document.add(new Paragraph("Tax Invoice / Bill of Supply", HEADING_FONT));
            document.add(new Paragraph(invoice.getTownName(), BODY_FONT));
            document.add(Chunk.NEWLINE);

            document.add(metaLine("Order No.", invoice.getOrderNumber()));
            document.add(metaLine("Date", formatInstant(invoice.getPlacedAt())));
            document.add(metaLine("Payment", formatPayment(invoice)));
            document.add(Chunk.NEWLINE);

            document.add(new Paragraph("Deliver To", HEADING_FONT));
            for (String line : formatAddress(invoice.getDeliveryAddress(), invoice.getBuyerPhone())) {
                document.add(new Paragraph(line, BODY_FONT));
            }
            document.add(Chunk.NEWLINE);

            document.add(buildLineItemsTable(invoice));
            document.add(Chunk.NEWLINE);

            if (invoice.getCancelledItems() != null && !invoice.getCancelledItems().isEmpty()) {
                document.add(new Paragraph("Cancelled items (store credit issued)", HEADING_FONT));
                for (InvoiceDocument.CancelledLineItem cancelled : invoice.getCancelledItems()) {
                    String reason = cancelled.getReason() != null && !cancelled.getReason().isBlank()
                            ? " — " + cancelled.getReason()
                            : "";
                    document.add(new Paragraph(
                            cancelled.getQuantity() + "× " + cancelled.getItemName()
                                    + " (" + nullToDash(cancelled.getShopName()) + ") — credit "
                                    + formatMoney(cancelled.getStoreCreditAmount()) + reason,
                            SMALL_FONT));
                }
                document.add(Chunk.NEWLINE);
            }

            document.add(buildTotalsTable(invoice));
            document.add(Chunk.NEWLINE);

            document.add(new Paragraph(
                    "This is a computer-generated invoice. Prices are inclusive of applicable taxes unless stated.",
                    SMALL_FONT));

            document.close();
            return output.toByteArray();
        } catch (DocumentException ex) {
            log.error("Failed to generate invoice PDF for order {}", invoice.getOrderNumber(), ex);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Failed to generate invoice PDF");
        }
    }

    private Paragraph metaLine(String label, String value) {
        Paragraph paragraph = new Paragraph();
        paragraph.add(new Chunk(label + ": ", HEADING_FONT));
        paragraph.add(new Chunk(value != null ? value : "-", BODY_FONT));
        return paragraph;
    }

    private PdfPTable buildLineItemsTable(InvoiceDocument invoice) throws DocumentException {
        PdfPTable table = new PdfPTable(new float[]{4f, 2f, 1f, 1.5f, 1.5f});
        table.setWidthPercentage(100);
        addHeaderCell(table, "Item");
        addHeaderCell(table, "Shop");
        addHeaderCell(table, "Qty");
        addHeaderCell(table, "Rate");
        addHeaderCell(table, "Amount");

        for (InvoiceDocument.InvoiceLineItem item : invoice.getLineItems()) {
            addBodyCell(table, item.getItemName());
            addBodyCell(table, nullToDash(item.getShopName()));
            addBodyCell(table, String.valueOf(item.getQuantity()));
            addBodyCell(table, formatMoney(item.getUnitPrice()));
            addBodyCell(table, formatMoney(item.getLineTotal()));
        }
        return table;
    }

    private PdfPTable buildTotalsTable(InvoiceDocument invoice) throws DocumentException {
        PdfPTable table = new PdfPTable(new float[]{3f, 1f});
        table.setWidthPercentage(45);
        table.setHorizontalAlignment(Element.ALIGN_RIGHT);

        addTotalRow(table, "Items Subtotal", invoice.getItemsSubtotal());
        addTotalRow(table, "Delivery Fee", invoice.getDeliveryFee());
        if (isPositive(invoice.getPlatformFee())) {
            addTotalRow(table, "Platform Fee", invoice.getPlatformFee());
        }
        if (isPositive(invoice.getTaxAmount())) {
            addTotalRow(table, "Tax", invoice.getTaxAmount());
        }
        if (isPositive(invoice.getStoreCreditApplied())) {
            addTotalRow(table, "Store Credit Applied", invoice.getStoreCreditApplied().negate());
        }
        addTotalRow(table, "Grand Total", invoice.getTotalAmount(), true);
        return table;
    }

    private void addHeaderCell(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text, HEADING_FONT));
        cell.setBackgroundColor(new Color(240, 240, 240));
        cell.setPadding(4f);
        table.addCell(cell);
    }

    private void addBodyCell(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text, BODY_FONT));
        cell.setPadding(4f);
        table.addCell(cell);
    }

    private void addTotalRow(PdfPTable table, String label, BigDecimal amount) {
        addTotalRow(table, label, amount, false);
    }

    private void addTotalRow(PdfPTable table, String label, BigDecimal amount, boolean bold) {
        Font font = bold ? HEADING_FONT : BODY_FONT;
        PdfPCell labelCell = new PdfPCell(new Phrase(label, font));
        labelCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        labelCell.setPadding(3f);
        table.addCell(labelCell);

        PdfPCell amountCell = new PdfPCell(new Phrase(formatMoney(amount), font));
        amountCell.setBorder(Rectangle.NO_BORDER);
        amountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        amountCell.setPadding(3f);
        table.addCell(amountCell);
    }

    private String formatPayment(InvoiceDocument invoice) {
        String method = invoice.getPaymentMethod() != null ? invoice.getPaymentMethod().name() : "-";
        String status = invoice.getPaymentStatus() != null ? invoice.getPaymentStatus().name() : "-";
        return method + " (" + status + ")";
    }

    private String formatInstant(Instant instant) {
        if (instant == null) {
            return "-";
        }
        return DATE_FORMAT.format(instant.atZone(IST));
    }

    private String formatMoney(BigDecimal amount) {
        if (amount == null) {
            return "Rs. 0.00";
        }
        return "Rs. " + amount.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private boolean isPositive(BigDecimal amount) {
        return amount != null && amount.compareTo(BigDecimal.ZERO) > 0;
    }

    private String nullToDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String[] formatAddress(Map<String, Object> address, String buyerPhone) {
        if (address == null || address.isEmpty()) {
            return new String[]{buyerPhone != null ? buyerPhone : "-"};
        }
        String recipient = stringValue(address.get("recipientName"));
        String phone = stringValue(address.get("recipientPhone"));
        if (phone == null || phone.isBlank()) {
            phone = buyerPhone;
        }
        String line1 = stringValue(address.get("line1"));
        String line2 = stringValue(address.get("line2"));
        String landmark = stringValue(address.get("landmark"));
        String pincode = stringValue(address.get("pincode"));

        StringBuilder street = new StringBuilder();
        if (line1 != null) {
            street.append(line1);
        }
        if (line2 != null && !line2.isBlank()) {
            if (!street.isEmpty()) {
                street.append(", ");
            }
            street.append(line2);
        }
        if (landmark != null && !landmark.isBlank()) {
            if (!street.isEmpty()) {
                street.append(", ");
            }
            street.append(landmark);
        }
        if (pincode != null && !pincode.isBlank()) {
            if (!street.isEmpty()) {
                street.append(" - ");
            }
            street.append(pincode);
        }

        return new String[]{
                recipient != null ? recipient : "-",
                phone != null ? phone : "-",
                !street.isEmpty() ? street.toString() : "-"
        };
    }

    private String stringValue(Object value) {
        return value != null ? value.toString() : null;
    }
}
