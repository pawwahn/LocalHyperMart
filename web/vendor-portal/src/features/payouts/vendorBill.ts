import type { VendorSettlement } from '@/features/reports/api/payoutsApi';
import { settlementClaimAmount, settlementOtherChargesAmount } from '@/features/reports/api/payoutsApi';

/** Marketplace facilitation is a support service. Residual GST rate is 18%. */
export const SERVICE_SAC = '998599';
export const SERVICE_GST_PERCENT = 18;

const GST_STATE_NAMES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const ALPHA_TO_GST: Record<string, string> = {
  AP: '37',
  TS: '36',
  TG: '36',
  KA: '29',
  TN: '33',
  KL: '32',
  MH: '27',
  GJ: '24',
  RJ: '08',
  DL: '07',
  UP: '09',
  WB: '19',
  OR: '21',
  OD: '21',
  MP: '23',
  PB: '03',
  HR: '06',
  BR: '10',
  JH: '20',
  CG: '22',
  GA: '30',
  AS: '18',
};

export type BillParty = {
  legalName: string;
  gstin: string;
  address: string;
  phone: string;
  stateName: string;
  gstStateCode: string;
};

export type ServiceTaxSplit = {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  intraState: boolean;
};

export function gstStateCodeFromGstin(gstin: string): string {
  const code = gstin.trim().slice(0, 2);
  return /^[0-9]{2}$/.test(code) ? code : '';
}

export function gstStateCodeFromTown(stateCode?: string | null): string {
  const raw = (stateCode ?? '').trim().toUpperCase();
  if (/^[0-9]{2}$/.test(raw)) return raw;
  return ALPHA_TO_GST[raw] ?? '';
}

export function stateNameFor(code: string, fallback?: string): string {
  if (GST_STATE_NAMES[code]) return GST_STATE_NAMES[code];
  return fallback?.trim() || '';
}

/** Commission withheld on the payout is the GST-inclusive service fee. */
export function splitInclusiveServiceGst(inclusiveRupees: number, intraState: boolean): ServiceTaxSplit {
  const totalPaise = Math.max(0, Math.round(Number(inclusiveRupees || 0) * 100));
  const taxablePaise = Math.round((totalPaise * 100) / (100 + SERVICE_GST_PERCENT));
  const taxPaise = totalPaise - taxablePaise;
  if (!intraState) {
    return { taxablePaise, cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise, totalPaise, intraState: false };
  }
  const cgstPaise = Math.round(taxPaise / 2);
  return {
    taxablePaise,
    cgstPaise,
    sgstPaise: taxPaise - cgstPaise,
    igstPaise: 0,
    totalPaise,
    intraState: true,
  };
}

export function resolveTaxPlace(supplier: BillParty, recipient: BillParty): { intraState: boolean; placeName: string; placeCode: string; assumed: boolean } {
  const fromCode = gstStateCodeFromGstin(supplier.gstin) || supplier.gstStateCode;
  const toCode = gstStateCodeFromGstin(recipient.gstin) || recipient.gstStateCode;
  if (fromCode && toCode) {
    const intra = fromCode === toCode;
    const placeCode = toCode;
    return {
      intraState: intra,
      placeName: stateNameFor(placeCode, recipient.stateName),
      placeCode,
      assumed: false,
    };
  }
  const placeCode = toCode || fromCode;
  return {
    intraState: true,
    placeName: stateNameFor(placeCode, recipient.stateName || supplier.stateName),
    placeCode,
    assumed: true,
  };
}

function rupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}₹${whole.toLocaleString('en-IN')}.${frac}`;
}

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function wordsUnder100(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
}

function wordsUnder1000(n: number): string {
  if (n < 100) return wordsUnder100(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return rest ? `${ONES[hundred]} Hundred ${wordsUnder100(rest)}` : `${ONES[hundred]} Hundred`;
}

export function rupeesInWords(paise: number): string {
  const rupee = Math.floor(Math.max(0, paise) / 100);
  const frac = Math.max(0, paise) % 100;
  if (rupee === 0 && frac === 0) return 'Indian Rupees Zero Only';
  const crore = Math.floor(rupee / 10000000);
  const lakh = Math.floor((rupee % 10000000) / 100000);
  const thousand = Math.floor((rupee % 100000) / 1000);
  const rest = rupee % 1000;
  const bits = [
    crore ? `${wordsUnder1000(crore)} Crore` : '',
    lakh ? `${wordsUnder100(lakh)} Lakh` : '',
    thousand ? `${wordsUnder100(thousand)} Thousand` : '',
    rest ? wordsUnder1000(rest) : '',
  ].filter(Boolean);
  const head = bits.length ? `Indian Rupees ${bits.join(' ')}` : 'Indian Rupees Zero';
  if (frac === 0) return `${head} Only`;
  return `${head} and ${wordsUnder100(frac)} Paise Only`;
}

function formatDay(value?: string | null): string {
  if (!value) return '—';
  const day = value.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatWhen(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function financialYear(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const month = Number.isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  const start = month >= 3 ? year : year - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

export function serviceInvoiceNumber(settlement: VendorSettlement): string {
  const stored = settlement.serviceInvoiceNumber?.trim();
  if (stored) return stored;
  const tail = settlement.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `HLM/SF/${financialYear(settlement.paidAt)}/${tail}`;
}

function partyBlock(title: string, party: BillParty): string {
  const gstin = party.gstin.trim()
    ? `GSTIN ${esc(party.gstin.trim())}`
    : 'GSTIN not on file';
  const state = [party.stateName, party.gstStateCode ? `State code ${party.gstStateCode}` : '']
    .filter(Boolean)
    .join(' · ');
  return `<div class="party">
    <div class="kicker">${esc(title)}</div>
    <strong>${esc(party.legalName || '—')}</strong>
    ${party.address ? `<div>${esc(party.address)}</div>` : ''}
    ${state ? `<div>${esc(state)}</div>` : ''}
    <div>${gstin}</div>
    ${party.phone ? `<div>${esc(party.phone)}</div>` : ''}
  </div>`;
}

export function vendorServiceBillHtml(
  settlement: VendorSettlement,
  supplier: BillParty,
  recipient: BillParty,
): string {
  const commission = Number(settlement.commissionAmount ?? 0);
  const claims = settlementClaimAmount(settlement);
  const other = settlementOtherChargesAmount(settlement);
  const gross = Number(settlement.grossAmount ?? 0);
  const net = Number(settlement.netAmount ?? 0);
  const place = resolveTaxPlace(supplier, recipient);
  const tax = splitInclusiveServiceGst(commission, place.intraState);
  const hasFee = tax.totalPaise > 0;
  const number = serviceInvoiceNumber(settlement);
  const period = `${formatDay(settlement.periodStart)} – ${formatDay(settlement.periodEnd)}`;
  const orders = (settlement.lines ?? []).filter((l) => {
    const t = (l.lineType ?? '').toUpperCase();
    return t === 'ORDER' || t === '';
  });
  const title = hasFee ? 'Tax invoice' : 'Payout statement';
  const taxRows = hasFee
    ? `<tr><td>Taxable value</td><td class="num">${rupees(tax.taxablePaise)}</td></tr>
       ${
         tax.intraState
           ? `<tr><td>CGST 9%</td><td class="num">${rupees(tax.cgstPaise)}</td></tr>
              <tr><td>SGST 9%</td><td class="num">${rupees(tax.sgstPaise)}</td></tr>`
           : `<tr><td>IGST 18%</td><td class="num">${rupees(tax.igstPaise)}</td></tr>`
       }
       <tr class="grand"><td>Invoice total (tax included)</td><td class="num">${rupees(tax.totalPaise)}</td></tr>`
    : `<tr class="grand"><td>Service fee</td><td class="num">${rupees(0)}</td></tr>`;

  const orderRows = orders.length
    ? orders
        .map(
          (line) => `<tr>
            <td>${esc(line.orderNumber || line.subOrderNumber || 'Order')}</td>
            <td class="num">${rupees(Math.round(Number(line.amount ?? 0) * 100))}</td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="2">Order list was not stored on this payout.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(number)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e7efe9; color: #14221b; font-family: "Segoe UI", "Noto Sans", sans-serif; }
  .sheet { max-width: 820px; margin: 16px auto; background: #fff; padding: 28px 32px 22px; }
  .top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .brand { font-size: 13px; letter-spacing: 0.16em; font-weight: 800; color: #166534; }
  h1 { margin: 2px 0 0; font-size: 28px; letter-spacing: -0.03em; }
  .sub { margin-top: 4px; color: #3f5348; font-size: 13px; }
  .stamp { border: 2px solid #166534; color: #166534; font-weight: 800; letter-spacing: 0.12em; padding: 6px 10px; }
  .meta { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
  .meta b { font-weight: 700; }
  .parties { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .party { border: 1px solid #d7e3db; border-radius: 10px; padding: 10px 12px; font-size: 13px; line-height: 1.45; }
  .kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #166534; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
  th { text-align: left; background: #f3faf6; color: #14532d; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
  th, td { border-bottom: 1px solid #e5eee8; padding: 8px 6px; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { width: 280px; margin-left: auto; }
  .totals td { border: none; padding: 3px 0; }
  .grand td { border-top: 2px solid #14532d; font-weight: 800; padding-top: 8px; font-size: 15px; }
  .note { margin-top: 12px; font-size: 12.5px; line-height: 1.45; color: #24382d; }
  .words { margin-top: 8px; font-size: 13px; }
  .recon { margin-top: 8px; background: #f7fbf8; border-radius: 10px; padding: 10px 12px; }
  .foot { margin-top: 16px; font-size: 11px; color: #5b6b62; line-height: 1.4; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; max-width: none; padding: 0; }
  }
</style>
</head>
<body>
<article class="sheet">
  <div class="top">
    <div>
      <div class="brand">KOYAKART</div>
      <h1>${esc(title)}</h1>
      <div class="sub">${hasFee ? 'Marketplace service fee, deducted from your shop payout' : 'No service fee on this payout'}</div>
    </div>
    <div class="stamp">PAID</div>
  </div>
  <div class="meta">
    <div><b>Invoice no.</b> ${esc(number)}</div>
    <div><b>Issued</b> ${esc(formatWhen(settlement.paidAt))}</div>
    <div><b>Orders window</b> ${esc(period)}</div>
    <div><b>Place of supply</b> ${esc(place.placeName || '—')}${place.placeCode ? ` (${esc(place.placeCode)})` : ''}</div>
  </div>
  <div class="parties">
    ${partyBlock('Supplier', supplier)}
    ${partyBlock('Bill to', recipient)}
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>SAC</th>
        <th class="num">Qty</th>
        <th class="num">Taxable</th>
        <th class="num">GST</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Marketplace facilitation for customer orders in this window. Listing, order handling, and payout.</td>
        <td>${SERVICE_SAC}</td>
        <td class="num">1</td>
        <td class="num">${rupees(tax.taxablePaise)}</td>
        <td class="num">${hasFee ? (tax.intraState ? '9% + 9%' : '18% IGST') : '—'}</td>
        <td class="num">${rupees(tax.totalPaise)}</td>
      </tr>
    </tbody>
  </table>
  <table class="totals">
    <tbody>${taxRows}</tbody>
  </table>
  <p class="words"><b>Amount in words.</b> ${esc(rupeesInWords(tax.totalPaise))}</p>
  <p class="note">${
    hasFee
      ? 'This bill is the service fee already subtracted from your payout. Do not pay it again. The amount above is GST-inclusive at 18%.'
      : 'This payout had no marketplace fee, so there is no GST on this statement.'
  }${
    place.assumed
      ? ' Tax is shown as CGST and SGST because the two GST state codes were not both on file.'
      : ''
  } Reverse charge does not apply.</p>
  <div class="recon">
    <div class="kicker">How this sits on the payout</div>
    <table>
      <tbody>
        <tr><td>Shop sales in the window</td><td class="num">${rupees(Math.round(gross * 100))}</td></tr>
        <tr><td>Service fee (this invoice)</td><td class="num">${rupees(tax.totalPaise)}</td></tr>
        <tr><td>Claim deductions</td><td class="num">${rupees(Math.round(claims * 100))}</td></tr>
        <tr><td>Other charges</td><td class="num">${rupees(Math.round(other * 100))}</td></tr>
        <tr class="grand"><td>Net transferred to you</td><td class="num">${rupees(Math.round(net * 100))}</td></tr>
      </tbody>
    </table>
    <div class="note">Paid ${esc(formatWhen(settlement.paidAt))} · ${esc(settlement.payoutMethod || '—')} · Ref ${esc(settlement.transactionReference || '—')}</div>
  </div>
  <table>
    <thead><tr><th>Orders included</th><th class="num">Sale</th></tr></thead>
    <tbody>${orderRows}</tbody>
  </table>
  <p class="foot">SAC ${SERVICE_SAC} — other support services. GST ${SERVICE_GST_PERCENT}%. Goods sold to customers are on the buyer invoice, not on this bill. Computer-generated. No signature required.</p>
</article>
</body>
</html>`;
}

export function downloadVendorServiceBill(
  settlement: VendorSettlement,
  supplier: BillParty,
  recipient: BillParty,
): void {
  const html = vendorServiceBillHtml(settlement, supplier, recipient);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const start = (settlement.periodStart ?? 'payout').slice(0, 10);
  const end = (settlement.periodEnd ?? start).slice(0, 10);
  link.href = url;
  link.download = `KoYaKart-bill-${start}-to-${end}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
