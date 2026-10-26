# Read-only payout / fee reconciliation against local dev Postgres (hlm-postgres).
# Usage:
#   .\scripts\reconcile-vendor-payouts.ps1 -BusinessName "R K Fancy"
#   .\scripts\reconcile-vendor-payouts.ps1 -VendorId "93f2e3b0-dd0c-4afc-bd20-3366e5261339"

param(
    [string]$VendorId = "",
    [string]$BusinessName = "",
    [string]$PostgresContainer = "hlm-postgres",
    [string]$PgUser = "hyperlocalmart"
)

function Invoke-Psql {
    param([string]$Database, [string]$Sql)
    docker exec $PostgresContainer psql -U $PgUser -d $Database -v ON_ERROR_STOP=1 -c $Sql 2>&1
}

if (-not $VendorId) {
    if (-not $BusinessName) {
        Write-Error "Pass -VendorId or -BusinessName"
        exit 1
    }
    $escaped = $BusinessName.Replace("'", "''")
    $row = Invoke-Psql "hyperlocalmart_vendor" "SELECT id::text, business_name, phone FROM vendors WHERE business_name ILIKE '%$escaped%' LIMIT 1;"
    if ($row -match "0 rows") {
        Write-Error "Vendor not found: $BusinessName"
        exit 1
    }
    Write-Host $row
    $VendorId = ([regex]::Match($row, "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")).Groups[1].Value
    if (-not $VendorId) {
        Write-Error "Could not parse vendor id from query output"
        exit 1
    }
}

Write-Host "`n=== Vendor $VendorId ===" -ForegroundColor Cyan

Write-Host "`n-- Fee history (vendor_commercial_terms) --"
Invoke-Psql "hyperlocalmart_vendor" @"
SELECT fee_model, commission_percent, per_order_flat_amount, monthly_subscription_amount,
       effective_from, COALESCE(effective_to::text, 'open') AS effective_to
FROM vendor_commercial_terms
WHERE vendor_id = '$VendorId'
ORDER BY effective_from;
"@

Write-Host "`n-- Delivered bags vs settled ORDER lines --"
Invoke-Psql "hyperlocalmart_order" @"
SELECT
  (SELECT COUNT(*) FROM vendor_sub_orders WHERE vendor_id = '$VendorId' AND status = 'DELIVERED') AS delivered_bags,
  (SELECT COALESCE(SUM(subtotal), 0) FROM vendor_sub_orders WHERE vendor_id = '$VendorId' AND status = 'DELIVERED') AS delivered_goods;
"@
Invoke-Psql "hyperlocalmart_payment" @"
SELECT COUNT(DISTINCT sli.sub_order_id) AS bags_on_settlements
FROM settlement_line_items sli
JOIN settlements s ON s.id = sli.settlement_id
WHERE s.payee_id = '$VendorId' AND s.payee_type = 'VENDOR'
  AND sli.line_type = 'ORDER' AND sli.sub_order_id IS NOT NULL;
"@

Write-Host "`n-- Settlements summary --"
Invoke-Psql "hyperlocalmart_payment" @"
SELECT direction, status, period_start, period_end,
       gross_amount, commission_amount, net_amount,
       paid_at IS NOT NULL AS paid
FROM settlements
WHERE payee_id = '$VendorId' AND payee_type = 'VENDOR'
ORDER BY period_start, created_at;
"@

Write-Host "`n-- COLLECTION: fee lines must sum to commission_amount --"
Invoke-Psql "hyperlocalmart_payment" @"
SELECT s.id, s.commission_amount,
       COALESCE(SUM(sli.amount) FILTER (WHERE sli.line_type <> 'ORDER'), 0) AS non_order_lines_sum,
       s.commission_amount - COALESCE(SUM(sli.amount) FILTER (WHERE sli.line_type <> 'ORDER'), 0) AS delta
FROM settlements s
LEFT JOIN settlement_line_items sli ON sli.settlement_id = s.id
WHERE s.payee_id = '$VendorId' AND s.direction = 'COLLECTION'
GROUP BY s.id, s.commission_amount
HAVING ABS(s.commission_amount - COALESCE(SUM(sli.amount) FILTER (WHERE sli.line_type <> 'ORDER'), 0)) > 0.01
   OR s.commission_amount IS NULL;
"@

Write-Host "`n-- COLLECTION with ORDER bags but no PLATFORM/COD/MEMBERSHIP lines (review shop-held pass-through) --"
Invoke-Psql "hyperlocalmart_payment" @"
SELECT s.id, s.period_end, s.commission_amount,
       EXISTS (SELECT 1 FROM settlement_line_items x WHERE x.settlement_id = s.id AND x.line_type = 'ORDER') AS has_orders,
       EXISTS (SELECT 1 FROM settlement_line_items x WHERE x.settlement_id = s.id AND x.line_type IN ('PLATFORM_FEE','COD_FEE','MEMBERSHIP_FEE')) AS has_pass_through_lines
FROM settlements s
WHERE s.payee_id = '$VendorId' AND s.direction = 'COLLECTION'
  AND EXISTS (SELECT 1 FROM settlement_line_items x WHERE x.settlement_id = s.id AND x.line_type = 'ORDER')
  AND NOT EXISTS (SELECT 1 FROM settlement_line_items x WHERE x.settlement_id = s.id AND x.line_type IN ('PLATFORM_FEE','COD_FEE','MEMBERSHIP_FEE'));
"@

Write-Host "`n-- Terms timeline gaps (days with no covering fee row) --"
Invoke-Psql "hyperlocalmart_vendor" @"
WITH terms AS (
  SELECT effective_from AS d_from,
         COALESCE(effective_to, CURRENT_DATE) AS d_to
  FROM vendor_commercial_terms
  WHERE vendor_id = '$VendorId'
  ORDER BY effective_from
),
ordered AS (
  SELECT d_from, d_to,
         LEAD(d_from) OVER (ORDER BY d_from) AS next_from
  FROM terms
)
SELECT d_to + 1 AS gap_start, next_from - 1 AS gap_end
FROM ordered
WHERE next_from IS NOT NULL AND next_from > d_to + 1;
"@

Write-Host "`n-- Orders placed in fee gaps (commercial fee = 0 in engine) --"
$gapSql = @"
SELECT (d_to + 1)::text || '|' || (next_from - 1)::text
FROM (
  SELECT d_from, d_to, LEAD(d_from) OVER (ORDER BY d_from) AS next_from
  FROM (
    SELECT effective_from AS d_from, COALESCE(effective_to, CURRENT_DATE) AS d_to
    FROM vendor_commercial_terms WHERE vendor_id = '$VendorId'
  ) t
) ordered
WHERE next_from IS NOT NULL AND next_from > d_to + 1;
"@
$gapLines = docker exec $PostgresContainer psql -U $PgUser -d hyperlocalmart_vendor -t -A -c $gapSql 2>$null
foreach ($line in ($gapLines -split "`n" | Where-Object { $_.Trim() })) {
    $parts = $line.Trim().Split("|")
    if ($parts.Count -lt 2) { continue }
    $gs, $ge = $parts[0], $parts[1]
    Write-Host "  Gap $gs -> $ge"
    Invoke-Psql "hyperlocalmart_order" @"
SELECT o.order_number, o.placed_at::date AS placed, vso.subtotal
FROM vendor_sub_orders vso
JOIN orders o ON o.id = vso.order_id
WHERE vso.vendor_id = '$VendorId' AND vso.status = 'DELIVERED'
  AND o.placed_at::date BETWEEN '$gs' AND '$ge'
ORDER BY o.placed_at;
"@
}

Write-Host "`n-- Orders where total_amount != formula (incl. store credit) --"
Invoke-Psql "hyperlocalmart_order" @"
SELECT order_number, items_subtotal, store_credit_applied, total_amount,
       GREATEST(
         COALESCE(items_subtotal,0)-COALESCE(promo_discount,0)
         +COALESCE(delivery_fee,0)+COALESCE(platform_fee,0)
         +COALESCE(cod_fee,0)+COALESCE(membership_fee,0)
         -COALESCE(store_credit_applied,0), 0) AS expected_total
FROM orders o
WHERE EXISTS (
  SELECT 1 FROM vendor_sub_orders v
  WHERE v.order_id = o.id AND v.vendor_id = '$VendorId' AND v.status = 'DELIVERED'
)
AND total_amount IS DISTINCT FROM GREATEST(
  COALESCE(items_subtotal,0)-COALESCE(promo_discount,0)
  +COALESCE(delivery_fee,0)+COALESCE(platform_fee,0)
  +COALESCE(cod_fee,0)+COALESCE(membership_fee,0)
  -COALESCE(store_credit_applied,0), 0);
"@

Write-Host "`nDone (read-only).`n" -ForegroundColor Green
