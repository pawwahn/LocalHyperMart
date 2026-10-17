import type { PlatformSettingsVm } from '@/features/settings/api/settingsApi';
import type { TownVm } from '@/features/towns/api/townsApi';
import type { VendorVm } from '@/features/vendors/api/vendorsApi';
import type { SubscriptionBill } from './api/settlementsApi';

const SERVICE_SAC = '998599';
const GST_PERCENT = 18;

const GST_STATE_NAMES: Record<string, string> = {
  '07': 'Delhi',
  '24': 'Gujarat',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
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
  DL: '07',
};

type Party = { legalName: string; gstin: string; address: string; phone: string; stateName: string; stateCode: string };

function gstCodeFromGstin(gstin: string): string {
  const code = gstin.trim().slice(0, 2);
  return /^[0-9]{2}$/.test(code) ? code : '';
}

function gstCodeFromTown(stateCode?: string | null): string {
  const raw = (stateCode ?? '').trim().toUpperCase();
  return /^[0-9]{2}$/.test(raw) ? raw : ALPHA_TO_GST[raw] ?? '';
}

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function rupees(paise: number): string {
  const whole = Math.floor(Math.abs(paise) / 100);
  const frac = String(Math.abs(paise) % 100).padStart(2, '0');
  return `${paise < 0 ? '-' : ''}₹${whole.toLocaleString('en-IN')}.${frac}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  return n % 10 ? `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}` : TENS[Math.floor(n / 10)];
}

function under1000(n: number): string {
  if (n < 100) return under100(n);
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` ${under100(rest)}` : ''}`;
}

function rupeesInWords(paise: number): string {
  const r = Math.floor(Math.max(0, paise) / 100);
  const p = Math.max(0, paise) % 100;
  const bits = [
    Math.floor(r / 10000000) ? `${under1000(Math.floor(r / 10000000))} Crore` : '',
    Math.floor((r % 10000000) / 100000) ? `${under100(Math.floor((r % 10000000) / 100000))} Lakh` : '',
    Math.floor((r % 100000) / 1000) ? `${under100(Math.floor((r % 100000) / 1000))} Thousand` : '',
    r % 1000 ? under1000(r % 1000) : '',
  ].filter(Boolean);
  const head = `Indian Rupees ${bits.length ? bits.join(' ') : 'Zero'}`;
  return p ? `${head} and ${under100(p)} Paise Only` : `${head} Only`;
}

function formatDay(value?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!m) return '—';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatWhen(value?: string | null): string {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function partyBlock(title: string, p: Party): string {
  const state = [p.stateName, p.stateCode ? `State code ${p.stateCode}` : ''].filter(Boolean).join(' · ');
  return `<div class="party">
    <div class="kicker">${esc(title)}</div>
    <strong>${esc(p.legalName || '—')}</strong>
    ${p.address ? `<div>${esc(p.address)}</div>` : ''}
    ${state ? `<div>${esc(state)}</div>` : ''}
    <div>${p.gstin ? `GSTIN ${esc(p.gstin)}` : 'GSTIN not on file'}</div>
    ${p.phone ? `<div>${esc(p.phone)}</div>` : ''}
  </div>`;
}

export function subscriptionBillHtml(
  bill: SubscriptionBill,
  vendor: VendorVm | null | undefined,
  town: TownVm | null | undefined,
  settings: PlatformSettingsVm | null,
): string {
  const supplierGstin = (settings?.supplierGstin ?? '').trim().toUpperCase();
  const supplierCode = gstCodeFromGstin(supplierGstin) || (settings?.supplierGstStateCode ?? '').trim();
  const supplier: Party = {
    legalName: settings?.supplierLegalName || 'KoyaKart',
    gstin: supplierGstin,
    address: settings?.supplierAddress ?? '',
    phone: settings?.supportPhone ?? '',
    stateName: GST_STATE_NAMES[supplierCode] || settings?.supplierState || '',
    stateCode: supplierCode,
  };
  const vendorGstin = (vendor?.gstNumber ?? '').trim().toUpperCase();
  const vendorCode = gstCodeFromGstin(vendorGstin) || gstCodeFromTown(town?.stateCode);
  const recipient: Party = {
    legalName: vendor?.shopName || vendor?.businessName || 'Vendor',
    gstin: vendorGstin,
    address: vendor?.address ?? '',
    phone: vendor?.phone ?? '',
    stateName: GST_STATE_NAMES[vendorCode] || town?.state || '',
    stateCode: vendorCode,
  };

  const intra = !supplierCode || !vendorCode || supplierCode === vendorCode;
  const totalPaise = Math.max(0, Math.round(Number(bill.amount ?? 0) * 100));
  const taxablePaise = Math.round((totalPaise * 100) / (100 + GST_PERCENT));
  const taxPaise = totalPaise - taxablePaise;
  const cgstPaise = Math.round(taxPaise / 2);
  const paid = bill.status === 'PAID';
  const issued = Boolean(bill.invoiceNumber);
  const number = bill.invoiceNumber || 'Assigned when the bill is sent';
  const placeCode = vendorCode || supplierCode;
  const placeName = GST_STATE_NAMES[placeCode] || recipient.stateName || supplier.stateName;
  const title = issued ? 'Tax invoice' : 'Subscription bill (preview)';
  const taxRows = intra
    ? `<tr><td>CGST 9%</td><td class="num">${rupees(cgstPaise)}</td></tr>
       <tr><td>SGST 9%</td><td class="num">${rupees(taxPaise - cgstPaise)}</td></tr>`
    : `<tr><td>IGST 18%</td><td class="num">${rupees(taxPaise)}</td></tr>`;
  const paymentBlock = bill.bankPaidOn
    ? `Bank statement ${esc(formatDay(bill.bankPaidOn))} · ${esc((paid ? bill.payoutMethod : bill.vendorPaymentMethod) || '—')} · Ref ${esc((paid ? bill.transactionReference : bill.vendorPaymentReference) || '—')} · vendor acknowledged ${esc(formatWhen(bill.vendorPaidAt))}`
    : paid
      ? `Received ${esc(formatWhen(bill.paidAt))} · ${esc(bill.payoutMethod || '—')} · Ref ${esc(bill.transactionReference || '—')}`
      : bill.vendorPaidAt
        ? `Vendor reported payment ${esc(formatWhen(bill.vendorPaidAt))} · ${esc(bill.vendorPaymentMethod || '—')} · Ref ${esc(bill.vendorPaymentReference || '—')} · awaiting KoyaKart confirmation`
        : `Amount due ${rupees(totalPaise)} for ${esc(monthName(bill.month))}. Pay KoyaKart by UPI / bank transfer, then enter the UTR / UPI reference on the Payouts page in your vendor portal.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(issued ? number : `Subscription ${monthName(bill.month)} · ${recipient.legalName}`)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ede9fe; color: #1e1b2e; font-family: "Segoe UI", "Noto Sans", sans-serif; }
  .sheet { max-width: 820px; margin: 16px auto; background: #fff; padding: 28px 32px 22px; }
  .top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .brand { font-size: 13px; letter-spacing: 0.16em; font-weight: 800; color: #166534; }
  h1 { margin: 2px 0 0; font-size: 28px; letter-spacing: -0.03em; }
  .sub { margin-top: 4px; color: #4b4560; font-size: 13px; }
  .stamp { border: 2px solid ${paid ? '#166534' : '#c2410c'}; color: ${paid ? '#166534' : '#c2410c'}; font-weight: 800; letter-spacing: 0.12em; padding: 6px 10px; }
  .meta { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
  .parties { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .party { border: 1px solid #ddd6fe; border-radius: 10px; padding: 10px 12px; font-size: 13px; line-height: 1.45; }
  .kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #5b21b6; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
  th { text-align: left; background: #f5f3ff; color: #4c1d95; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
  th, td { border-bottom: 1px solid #ede9fe; padding: 8px 6px; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { width: 280px; margin-left: auto; }
  .totals td { border: none; padding: 3px 0; }
  .grand td { border-top: 2px solid #4c1d95; font-weight: 800; padding-top: 8px; font-size: 15px; }
  .note { margin-top: 12px; font-size: 12.5px; line-height: 1.45; }
  .pay { margin-top: 10px; background: #f8f7ff; border-radius: 10px; padding: 10px 12px; font-size: 13px; }
  .foot { margin-top: 16px; font-size: 11px; color: #6b6480; line-height: 1.4; }
  @media print { body { background: #fff; } .sheet { margin: 0; max-width: none; padding: 0; } }
</style>
</head>
<body>
<article class="sheet">
  <div class="top">
    <div>
      <div class="brand">KOYAKART</div>
      <h1>${esc(title)}</h1>
      <div class="sub">Monthly marketplace subscription — billed separately from order commission and payouts</div>
    </div>
    <div class="stamp">${paid ? 'PAID' : 'DUE'}</div>
  </div>
  <div class="meta">
    <div><b>Invoice no.</b> ${esc(number)}</div>
    <div><b>Issued</b> ${esc(issued ? formatWhen(bill.billSentAt) : '—')}</div>
    <div><b>Billing month</b> ${esc(formatDay(bill.periodStart))} – ${esc(formatDay(bill.periodEnd))}</div>
    <div><b>Place of supply</b> ${esc(placeName || '—')}${placeCode ? ` (${esc(placeCode)})` : ''}</div>
  </div>
  <div class="parties">
    ${partyBlock('Supplier', supplier)}
    ${partyBlock('Bill to', recipient)}
  </div>
  <table>
    <thead>
      <tr><th>Description</th><th>SAC</th><th class="num">Qty</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Monthly marketplace subscription · ${esc(monthName(bill.month))}</td>
        <td>${SERVICE_SAC}</td>
        <td class="num">1</td>
        <td class="num">${rupees(taxablePaise)}</td>
        <td class="num">${intra ? '9% + 9%' : '18% IGST'}</td>
        <td class="num">${rupees(totalPaise)}</td>
      </tr>
    </tbody>
  </table>
  <table class="totals">
    <tbody>
      <tr><td>Taxable value</td><td class="num">${rupees(taxablePaise)}</td></tr>
      ${taxRows}
      <tr class="grand"><td>${paid ? 'Invoice total' : 'Total due'} (tax included)</td><td class="num">${rupees(totalPaise)}</td></tr>
    </tbody>
  </table>
  <p class="note"><b>Amount in words.</b> ${esc(rupeesInWords(totalPaise))}</p>
  <div class="pay">${paymentBlock}</div>
  <p class="note">The subscription is GST-inclusive at ${GST_PERCENT}%. It is not deducted from payouts and not combined with commission on shop-held COD. Reverse charge does not apply.</p>
  <p class="foot">SAC ${SERVICE_SAC} — other support services. Computer-generated. No signature required.</p>
</article>
</body>
</html>`;
}

/** Opens the bill in a new tab (print / save as PDF); downloads it if pop-ups are blocked. */
export function openSubscriptionBill(html: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const win = window.open(url, '_blank');
  if (!win) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
