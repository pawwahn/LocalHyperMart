import ExcelJS from 'exceljs';
import type { BulkSyncRow, BulkSyncResult } from './listingsApi';
import type { ListingView, MasterItemView } from './listingsApi';

export const CATALOG_SHEET = 'Catalog';
const INSTRUCTIONS_SHEET = 'How to use';
/** System-only copy for “changed row” highlighting — not shown to vendors. */
const BASELINE_SHEET = 'Baseline';

const COLUMN_COUNT = 12;
const READONLY_DATA_COLUMN_COUNT = 7;
/** Freeze A–D (List, ID, barcode, product name); scroll E–L horizontally. */
const FROZEN_LEADING_COLUMNS = 4;
const DATA_START_ROW = 3;
const RED_TEXT = { argb: 'FFCC0000' } as const;
/** Buyer visibility dropdown (column K). */
const VISIBILITY_COLUMN_LETTER = 'K';

/** Catalog sheet columns A–L (no discount price — Sell vs MRP only). */
export const CATALOG_HEADERS = [
  'List (Y/N)',
  'Master Item ID',
  'Barcode',
  'Product name',
  'Category',
  'Admin MRP (₹)',
  'Unit',
  'Your MRP (₹)',
  'Sell price (₹)',
  'Other search names',
  'Buyer visibility',
  'Shop note',
] as const;

/** Upload: accept new headers and older exports. */
const HEADER_ALIASES: Record<string, string> = {
  'List (Y/N)': 'List (Y/N)',
  List: 'List (Y/N)',
  'Master Item ID': 'Master Item ID',
  Barcode: 'Barcode',
  'Product name': 'Product name',
  Product: 'Product name',
  Category: 'Category',
  'Admin MRP (₹)': 'Admin MRP (₹)',
  'Admin MRP': 'Admin MRP (₹)',
  Unit: 'Unit',
  'Sell price (₹)': 'Sell price (₹)',
  Sell: 'Sell price (₹)',
  'Your MRP (₹)': 'Your MRP (₹)',
  MRP: 'Your MRP (₹)',
  'Discount price (₹)': 'Discount price (₹)',
  Discount: 'Discount price (₹)',
  'Shop note': 'Shop note',
  Note: 'Shop note',
  'Other search names': 'Other search names',
  'Other names': 'Other search names',
  'Buyer visibility': 'Buyer visibility',
  'Buyer display': 'Buyer visibility',
};

/** Legacy 13-column export (… Discount, Shop note, Other names, Buyer visibility). */
const LEGACY_LAYOUT = {
  discount: 'Discount price (₹)',
  note: 'Shop note',
  other: 'Other search names',
  visibility: 'Buyer visibility',
} as const;

export type CatalogWorkbookMode = 'template' | 'vendor';

export type CatalogExcelRow = {
  sheetRow: number;
  masterItemId: string;
  list: boolean;
  listRaw: string;
  barcode: string;
  product: string;
  category: string;
  adminMrp: string;
  unit: string;
  sell: string;
  mrp: string;
  note: string;
  otherNames: string;
  buyerDisplay: string;
};

export type CatalogUploadCellError = {
  sheetRow: number;
  product: string;
  column: string;
  message: string;
};

export class CatalogUploadValidationError extends Error {
  readonly cellErrors: CatalogUploadCellError[];

  constructor(cellErrors: CatalogUploadCellError[]) {
    super(formatCatalogUploadErrors(cellErrors));
    this.name = 'CatalogUploadValidationError';
    this.cellErrors = cellErrors;
  }
}

const COL = {
  list: 'List (Y/N)',
  mrp: 'Your MRP (₹)',
  sell: 'Sell price (₹)',
  visibility: 'Buyer visibility',
  otherNames: 'Other search names',
} as const;

const MAX_OTHER_NAMES = 500;

function buyerDisplayLabel(listing?: ListingView): string {
  if (!listing) return '';
  if (!listing.active) return 'Hide';
  if (listing.buyerOutOfStock) return 'Unhide (out of stock)';
  return 'Live';
}

function listLabel(listing: ListingView | undefined, mode: CatalogWorkbookMode): string {
  if (mode === 'template' || !listing) return 'N';
  return 'Y';
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(value);
}

function buildVisibleRow(
  master: MasterItemView,
  listing: ListingView | undefined,
  mode: CatalogWorkbookMode,
): string[] {
  const listed = listing != null && mode === 'vendor';
  const list = listLabel(listing, mode);
  const sell = listed ? listing!.price : '';
  const mrp = listed ? listing!.vendorMrp : '';
  const note = listed ? listing!.note : '';
  const other = listed ? listing!.searchNames : mode === 'template' ? master.searchNames : listing?.searchNames ?? '';
  const display = listed ? buyerDisplayLabel(listing) : '';

  return [
    list,
    master.id,
    master.barcode ?? '',
    master.name,
    master.category,
    master.mrp != null ? formatMoney(master.mrp) : '',
    master.unit,
    mrp,
    sell,
    other,
    display,
    note,
  ];
}

function baselineFromVisible(visible: string[], mode: CatalogWorkbookMode): string[] {
  if (mode === 'vendor') return [...visible];
  return visible.map((cell, idx) => (idx === 0 ? 'N' : cell));
}

function fileStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function addInstructionsSheet(wb: ExcelJS.Workbook) {
  const how = wb.addWorksheet(INSTRUCTIONS_SHEET);
  how.addRow(['Vendor catalog — column guide (Catalog sheet columns A–L)']);
  how.addRow([]);
  how.addRow(['Column', 'Heading', 'What it means']);
  how.addRow(['A', 'List (Y/N)', 'Y = you sell this item, N = not in your shop']);
  how.addRow(['B–G', 'Red text', 'Admin catalog — do not edit (ID, barcode, name, category, admin MRP, unit)']);
  how.addRow(['H', 'Your MRP (₹)', 'Shelf MRP — if higher than Sell, buyers see a discount']);
  how.addRow(['I', 'Sell price (₹)', 'Price buyers pay (required when List = Y). Discount vs MRP is automatic.']);
  how.addRow(['J', 'Other search names', 'Extra names for search only (comma-separated)']);
  how.addRow(['K', 'Buyer visibility', 'Live, Hide, or Unhide (out of stock)']);
  how.addRow(['L', 'Shop note', 'Short note shown to buyers (last column)']);
  how.addRow([]);
  how.addRow(['Use filter arrows on row 2 for any column. Columns A–D stay fixed when you scroll right.']);
  how.addRow(['Orange row = you changed something since download. Upload from Listings → Add products.']);
  how.getColumn(1).width = 10;
  how.getColumn(2).width = 22;
  how.getColumn(3).width = 58;
}

export async function downloadCatalogWorkbook(
  mode: CatalogWorkbookMode,
  masters: MasterItemView[],
  listedByMaster: Map<string, ListingView>,
  shopLabel?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HyperLocalMart Vendor Portal';
  wb.created = new Date();

  addInstructionsSheet(wb);

  const baselineWs = wb.addWorksheet(BASELINE_SHEET);
  baselineWs.state = 'veryHidden';
  // Match Catalog layout so row 3+ lines up for change highlighting.
  baselineWs.addRow([]);
  baselineWs.addRow([...CATALOG_HEADERS]);

  const ws = wb.addWorksheet(CATALOG_SHEET);

  ws.mergeCells(1, 1, 1, READONLY_DATA_COLUMN_COUNT);
  ws.getCell(1, 1).value = 'Admin catalog (red — do not edit names or IDs)';
  ws.getCell(1, 1).font = { bold: true, color: RED_TEXT };
  ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(1, READONLY_DATA_COLUMN_COUNT + 1, 1, COLUMN_COUNT);
  ws.getCell(1, READONLY_DATA_COLUMN_COUNT + 1).value = 'Your shop (black — edit when List = Y)';
  ws.getCell(1, READONLY_DATA_COLUMN_COUNT + 1).font = { bold: true };
  ws.getCell(1, READONLY_DATA_COLUMN_COUNT + 1).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.addRow([...CATALOG_HEADERS]);
  const header = ws.getRow(2);
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF5' } };
  for (let c = 1; c <= READONLY_DATA_COLUMN_COUNT; c += 1) {
    header.getCell(c).font = { bold: true, color: RED_TEXT };
  }
  for (let c = READONLY_DATA_COLUMN_COUNT + 1; c <= COLUMN_COUNT; c += 1) {
    header.getCell(c).font = { bold: true };
  }

  const sorted = [...masters].sort((a, b) => a.name.localeCompare(b.name));
  for (const master of sorted) {
    const listing = listedByMaster.get(master.id);
    const visible = buildVisibleRow(master, listing, mode);
    const baseline = baselineFromVisible(visible, mode);
    ws.addRow(visible);
    baselineWs.addRow(baseline);
  }

  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 38;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 34;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 14;
  ws.getColumn(7).width = 10;
  ws.getColumn(8).width = 14;
  ws.getColumn(9).width = 14;
  ws.getColumn(10).width = 24;
  ws.getColumn(11).width = 26;
  ws.getColumn(12).width = 28;

  const lastRow = ws.rowCount;

  ws.views = [
    {
      state: 'frozen',
      xSplit: FROZEN_LEADING_COLUMNS,
      ySplit: DATA_START_ROW - 1,
      topLeftCell: `E${DATA_START_ROW}`,
      activeCell: `A${DATA_START_ROW}`,
    },
  ];

  if (lastRow >= DATA_START_ROW) {
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: lastRow, column: COLUMN_COUNT },
    };
  }

  const editableColStart = READONLY_DATA_COLUMN_COUNT + 1;
  const editableColEnd = COLUMN_COUNT;

  if (lastRow >= DATA_START_ROW) {
    for (let r = DATA_START_ROW; r <= lastRow; r += 1) {
      const row = ws.getRow(r);
      for (let c = 1; c <= READONLY_DATA_COLUMN_COUNT; c += 1) {
        const cell = row.getCell(c);
        cell.font = { color: RED_TEXT };
        cell.protection = { locked: c > 1 };
      }
      for (let c = editableColStart; c <= editableColEnd; c += 1) {
        row.getCell(c).protection = { locked: false };
      }
    }

    const validations = (ws as ExcelJS.Worksheet & { dataValidations: { add: (r: string, o: object) => void } })
      .dataValidations;
    validations.add(`A${DATA_START_ROW}:A${lastRow}`, {
      type: 'list',
      allowBlank: false,
      formulae: ['"Y,N"'],
    });
    validations.add(`${VISIBILITY_COLUMN_LETTER}${DATA_START_ROW}:${VISIBILITY_COLUMN_LETTER}${lastRow}`, {
      type: 'list',
      allowBlank: true,
      formulae: ['"Live,Hide,Unhide (out of stock)"'],
    });
    validations.add(`H${DATA_START_ROW}:H${lastRow}`, {
      type: 'decimal',
      operator: 'greaterThan',
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Your MRP (₹)',
      error: 'Enter a number greater than 0, or leave blank.',
    });
    validations.add(`I${DATA_START_ROW}:I${lastRow}`, {
      type: 'decimal',
      operator: 'greaterThan',
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Sell price (₹)',
      error: 'Enter a number greater than 0 when List = Y.',
    });

    const baselineName = BASELINE_SHEET.replace(/'/g, "''");
    ws.addConditionalFormatting({
      ref: `A${DATA_START_ROW}:L${lastRow}`,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: [
            `=OR($A3<>${baselineName}!$A3,$H3<>${baselineName}!$H3,$I3<>${baselineName}!$I3,$J3<>${baselineName}!$J3,$K3<>${baselineName}!$K3,$L3<>${baselineName}!$L3)`,
          ],
          style: {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4CC' } },
          },
        },
      ],
    });

    ws.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      deleteColumns: false,
      deleteRows: false,
      sort: true,
      autoFilter: true,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const prefix = mode === 'template' ? 'admin-catalog-template' : 'my-catalog';
  const shop = shopLabel?.trim().replace(/\s+/g, '-').slice(0, 32) || 'shop';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${shop}-${fileStamp()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text.trim();
  }
  if (typeof value === 'number') return String(value);
  return String(value).trim();
}

function parseList(raw: string): boolean {
  const parsed = parseListStrict(raw);
  return parsed.ok ? parsed.listed : false;
}

function parseListStrict(raw: string): { ok: true; listed: boolean } | { ok: false } {
  const v = raw.trim();
  if (!v) return { ok: true, listed: false };
  const u = v.toUpperCase();
  if (u === 'Y' || u === 'YES' || u === 'TRUE' || u === '1') return { ok: true, listed: true };
  if (u === 'N' || u === 'NO' || u === 'FALSE' || u === '0') return { ok: true, listed: false };
  return { ok: false };
}

function parseMoneyStrict(
  raw: string,
  label: string,
  required: boolean,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) {
    if (required) {
      return { ok: false, message: `${label} is required when List = Y` };
    }
    return { ok: true, value: null };
  }
  const cleaned = t.replace(/[,₹\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { ok: false, message: `${label} must be a number (not text like “${t}”)` };
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, message: `${label} must be greater than zero` };
  }
  return { ok: true, value: n };
}

function parseVisibilityStrict(
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: 'LIVE' };
  const v = t.toLowerCase();
  if (
    v === 'live' ||
    v === 'hide' ||
    v === 'hidden' ||
    v.includes('unhide') ||
    v.includes('out of stock')
  ) {
    return { ok: true, value: parseBuyerVisibility(t) };
  }
  return {
    ok: false,
    message: `Use Live, Hide, or Unhide (out of stock) — not “${t}”`,
  };
}

export function formatCatalogUploadErrors(errors: CatalogUploadCellError[], limit = 24): string {
  if (errors.length === 0) return 'Validation failed';
  const lines = errors.slice(0, limit).map(
    (e) => `Row ${e.sheetRow} (${e.product}) — ${e.column}: ${e.message}`,
  );
  const more = errors.length > limit ? `\n…and ${errors.length - limit} more.` : '';
  return `Upload rejected. Fix these cells:\n${lines.join('\n')}${more}`;
}

export function parseBuyerVisibility(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (!v || v === 'live') return 'LIVE';
  if (v === 'hide' || v === 'hidden') return 'HIDDEN';
  if (v.includes('unhide') || v.includes('out of stock')) return 'OUT_OF_STOCK';
  return v.toUpperCase();
}

function findCatalogHeaderRow(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= Math.min(6, ws.rowCount); r += 1) {
    let hasMaster = false;
    ws.getRow(r).eachCell((cell) => {
      const label = HEADER_ALIASES[cellText(cell.value)] ?? cellText(cell.value);
      if (label === 'Master Item ID') hasMaster = true;
    });
    if (hasMaster) return r;
  }
  return 2;
}

function buildHeaderIndex(ws: ExcelJS.Worksheet, headerRowNum: number): Map<string, number> {
  const headerIdx = new Map<string, number>();
  ws.getRow(headerRowNum).eachCell((cell, col) => {
    const raw = cellText(cell.value);
    if (!raw || raw.startsWith('__base_')) return;
    const canonical = HEADER_ALIASES[raw] ?? raw;
    headerIdx.set(canonical, col);
  });
  return headerIdx;
}

export async function parseCatalogUpload(file: File): Promise<CatalogExcelRow[]> {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(CATALOG_SHEET) ?? wb.worksheets.find((s) => s.name !== INSTRUCTIONS_SHEET && s.name !== BASELINE_SHEET) ?? wb.worksheets[0];
  if (!ws) {
    throw new Error('No worksheet found in the uploaded file');
  }

  const headerRowNum = findCatalogHeaderRow(ws);
  const headerIdx = buildHeaderIndex(ws, headerRowNum);

  function col(canonical: string): number | undefined {
    return headerIdx.get(canonical);
  }

  function requireCol(canonical: string): number {
    const idx = col(canonical);
    if (!idx) {
      throw new Error(`Missing column “${canonical}”. Download a fresh template from the vendor portal.`);
    }
    return idx;
  }

  function cellAt(row: ExcelJS.Row, canonical: string): string {
    const idx = col(canonical);
    if (!idx) return '';
    return cellText(row.getCell(idx).value);
  }

  const hasLegacyDiscount = Boolean(col(LEGACY_LAYOUT.discount));

  const rows: CatalogExcelRow[] = [];
  for (let r = headerRowNum + 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const masterItemId = cellText(row.getCell(requireCol('Master Item ID')).value);
    if (!masterItemId) continue;

    let note = cellAt(row, 'Shop note');
    let otherNames = cellAt(row, 'Other search names');
    let buyerDisplay = cellAt(row, 'Buyer visibility');

    if (hasLegacyDiscount) {
      const legacyNoteIdx = col(LEGACY_LAYOUT.note);
      const legacyVisIdx = col(LEGACY_LAYOUT.visibility);
      const legacyOtherIdx = col(LEGACY_LAYOUT.other);
      if (legacyNoteIdx && legacyVisIdx && legacyOtherIdx && legacyNoteIdx < legacyVisIdx) {
        note = cellText(row.getCell(legacyNoteIdx).value);
        otherNames = cellText(row.getCell(legacyOtherIdx).value);
        buyerDisplay = cellText(row.getCell(legacyVisIdx).value);
      }
    }

    const listRaw = cellText(row.getCell(requireCol('List (Y/N)')).value);
    rows.push({
      sheetRow: r,
      masterItemId,
      list: parseList(listRaw),
      listRaw,
      barcode: cellAt(row, 'Barcode'),
      product: cellAt(row, 'Product name'),
      category: cellAt(row, 'Category'),
      adminMrp: cellAt(row, 'Admin MRP (₹)'),
      unit: cellAt(row, 'Unit'),
      sell: cellAt(row, 'Sell price (₹)'),
      mrp: cellAt(row, 'Your MRP (₹)'),
      note,
      otherNames,
      buyerDisplay,
    });
  }
  if (rows.length === 0) {
    throw new Error('The file has no product rows');
  }
  return rows;
}

function pushError(
  errors: CatalogUploadCellError[],
  row: CatalogExcelRow,
  column: string,
  message: string,
) {
  errors.push({
    sheetRow: row.sheetRow,
    product: row.product?.trim() || row.masterItemId,
    column,
    message,
  });
}

/** Validates every editable cell; throws {@link CatalogUploadValidationError} if any fail. */
export function validateAndBuildBulkSync(
  rows: CatalogExcelRow[],
  options?: { existingListingMasterIds?: ReadonlySet<string> },
): BulkSyncRow[] {
  const out: BulkSyncRow[] = [];
  const errors: CatalogUploadCellError[] = [];
  const existing = options?.existingListingMasterIds;

  for (const row of rows) {
    const listParsed = parseListStrict(row.listRaw);
    if (!listParsed.ok) {
      pushError(errors, row, COL.list, 'Use Y or N only');
      continue;
    }

    if (!listParsed.listed) {
      if (existing && !existing.has(row.masterItemId)) {
        continue;
      }
      out.push({ masterItemId: row.masterItemId, listed: false });
      continue;
    }

    const mrpResult = parseMoneyStrict(row.mrp, COL.mrp, false);
    if (!mrpResult.ok) {
      pushError(errors, row, COL.mrp, mrpResult.message);
    }

    const sellResult = parseMoneyStrict(row.sell, COL.sell, true);
    if (!sellResult.ok) {
      pushError(errors, row, COL.sell, sellResult.message);
    }

    const visResult = parseVisibilityStrict(row.buyerDisplay);
    if (!visResult.ok) {
      pushError(errors, row, COL.visibility, visResult.message);
    }

    const other = row.otherNames.trim();
    if (other.length > MAX_OTHER_NAMES) {
      pushError(
        errors,
        row,
        COL.otherNames,
        `Must be ${MAX_OTHER_NAMES} characters or less (currently ${other.length})`,
      );
    }

    if (!mrpResult.ok || !sellResult.ok || !visResult.ok || other.length > MAX_OTHER_NAMES) {
      continue;
    }

    if (mrpResult.value != null && sellResult.value != null && mrpResult.value < sellResult.value) {
      pushError(
        errors,
        row,
        COL.mrp,
        `Your MRP (₹${mrpResult.value}) cannot be less than Sell price (₹${sellResult.value})`,
      );
      continue;
    }

    out.push({
      masterItemId: row.masterItemId,
      listed: true,
      buyerVisibility: visResult.value,
      vendorMrp: mrpResult.value,
      price: sellResult.value!,
      discountPrice: null,
      vendorNote: row.note.trim() || null,
      searchNames: other || null,
    });
  }

  if (errors.length > 0) {
    throw new CatalogUploadValidationError(errors);
  }

  return out;
}

export function summarizeBulkSync(result: BulkSyncResult): string {
  const parts = [
    result.created ? `${result.created} new` : '',
    result.updated ? `${result.updated} updated` : '',
    result.hidden ? `${result.hidden} hidden` : '',
  ].filter(Boolean);
  const head = parts.length ? parts.join(', ') : 'Catalog saved';
  const buyerHint =
    ' Live and Out-of-stock items show in the buyer app; Hidden items do not.';
  if (result.failed > 0) {
    const first = result.errors[0];
    return `${head}. ${result.failed} row(s) failed — first: ${first?.productName ?? 'Product'}: ${first?.message ?? 'Error'}.${buyerHint}`;
  }
  return `${head}.${buyerHint}`;
}
