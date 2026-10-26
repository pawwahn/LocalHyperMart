package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.VendorGstReportResponse;
import com.hyperlocalmart.order.dto.response.VendorGstReportResponse.B2cDocumentRow;
import com.hyperlocalmart.order.dto.response.VendorGstReportResponse.HsnGstRow;
import com.hyperlocalmart.order.dto.response.VendorGstReportResponse.LineDetailRow;
import com.hyperlocalmart.order.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorGstReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;

    private final OrderItemRepository orderItemRepository;

    @Transactional(readOnly = true)
    public VendorGstReportResponse getReport(UUID vendorId, LocalDate from, LocalDate to, boolean includeLines) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo.minusDays(29);
        if (rangeFrom.isAfter(rangeTo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from must be on or before to");
        }
        if (ChronoUnit.DAYS.between(rangeFrom, rangeTo) + 1 > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }

        Instant start = rangeFrom.atStartOfDay(IST).toInstant();
        Instant end = rangeTo.plusDays(1).atStartOfDay(IST).toInstant();

        List<HsnGstRow> hsnRows = new ArrayList<>();
        BigDecimal taxable = BigDecimal.ZERO;
        BigDecimal cgst = BigDecimal.ZERO;
        BigDecimal sgst = BigDecimal.ZERO;
        BigDecimal igst = BigDecimal.ZERO;
        BigDecimal cess = BigDecimal.ZERO;
        long lineCount = 0;
        for (Object[] row : orderItemRepository.sumGstByHsnForVendorDelivered(vendorId, start, end)) {
            HsnGstRow mapped = HsnGstRow.builder()
                    .hsn(str(row[0]))
                    .gstPercent(money(bd(row[1])))
                    .lines(lng(row[2]))
                    .taxable(money(bd(row[3])))
                    .cgst(money(bd(row[4])))
                    .sgst(money(bd(row[5])))
                    .igst(money(bd(row[6])))
                    .cess(money(bd(row[7])))
                    .amount(money(bd(row[8])))
                    .build();
            hsnRows.add(mapped);
            lineCount += mapped.getLines();
            taxable = taxable.add(mapped.getTaxable());
            cgst = cgst.add(mapped.getCgst());
            sgst = sgst.add(mapped.getSgst());
            igst = igst.add(mapped.getIgst());
            cess = cess.add(mapped.getCess());
        }

        List<B2cDocumentRow> documents = new ArrayList<>();
        BigDecimal invoiceTotal = BigDecimal.ZERO;
        for (Object[] row : orderItemRepository.gstDocumentsForVendorDelivered(vendorId, start, end)) {
            B2cDocumentRow doc = B2cDocumentRow.builder()
                    .orderNumber(str(row[0]))
                    .subOrderNumber(str(row[1]))
                    .deliveredDate(toLocalDate(row[2]))
                    .paymentMethod(str(row[3]))
                    .taxable(money(bd(row[4])))
                    .cgst(money(bd(row[5])))
                    .sgst(money(bd(row[6])))
                    .igst(money(bd(row[7])))
                    .cess(money(bd(row[8])))
                    .invoiceValue(money(bd(row[9])))
                    .build();
            documents.add(doc);
            invoiceTotal = invoiceTotal.add(doc.getInvoiceValue());
        }

        List<LineDetailRow> lineDetails = List.of();
        if (includeLines) {
            List<LineDetailRow> lines = new ArrayList<>();
            for (Object[] row : orderItemRepository.gstLineDetailsForVendorDelivered(vendorId, start, end)) {
                lines.add(LineDetailRow.builder()
                        .orderNumber(str(row[0]))
                        .subOrderNumber(str(row[1]))
                        .deliveredDate(toLocalDate(row[2]))
                        .itemName(str(row[3]))
                        .hsn(str(row[4]))
                        .gstPercent(money(bd(row[5])))
                        .quantity(intVal(row[6]))
                        .taxable(money(bd(row[7])))
                        .cgst(money(bd(row[8])))
                        .sgst(money(bd(row[9])))
                        .igst(money(bd(row[10])))
                        .cess(money(bd(row[11])))
                        .lineTotal(money(bd(row[12])))
                        .build());
            }
            lineDetails = lines;
        }

        BigDecimal taxTotal = cgst.add(sgst).add(igst).add(cess);

        return VendorGstReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .vendorId(vendorId)
                .deliveredBagCount(documents.size())
                .lineCount(lineCount)
                .taxableTotal(money(taxable))
                .cgstTotal(money(cgst))
                .sgstTotal(money(sgst))
                .igstTotal(money(igst))
                .cessTotal(money(cess))
                .taxTotal(money(taxTotal))
                .invoiceValueTotal(money(invoiceTotal))
                .gstByHsn(hsnRows)
                .b2cDocuments(documents)
                .lineDetails(lineDetails)
                .build();
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static BigDecimal bd(Object o) {
        if (o == null) {
            return BigDecimal.ZERO;
        }
        if (o instanceof BigDecimal b) {
            return b;
        }
        return new BigDecimal(o.toString());
    }

    private static long lng(Object o) {
        if (o == null) {
            return 0L;
        }
        if (o instanceof Number n) {
            return n.longValue();
        }
        return Long.parseLong(o.toString());
    }

    private static int intVal(Object o) {
        if (o == null) {
            return 0;
        }
        if (o instanceof Number n) {
            return n.intValue();
        }
        return Integer.parseInt(o.toString());
    }

    private static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static LocalDate toLocalDate(Object o) {
        if (o == null) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Missing delivery date on GST row");
        }
        if (o instanceof LocalDate d) {
            return d;
        }
        if (o instanceof java.sql.Date d) {
            return d.toLocalDate();
        }
        if (o instanceof java.sql.Timestamp t) {
            return t.toInstant().atZone(IST).toLocalDate();
        }
        if (o instanceof Instant i) {
            return i.atZone(IST).toLocalDate();
        }
        if (o instanceof java.util.Date d) {
            return d.toInstant().atZone(IST).toLocalDate();
        }
        return LocalDate.parse(o.toString());
    }
}
