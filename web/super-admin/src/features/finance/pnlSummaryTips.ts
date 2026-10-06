/** Plain-language tooltips for Finance ledger → P&L summary cards. */
export const PNL_SUMMARY_TIPS = {
  platformResult:
    'Headline for this date range: estimated platform revenue minus buyer refunds, payment gateway fees, and wallet gifts. Does not include rent, salaries, or other office costs (pre-opex). Surplus = you kept more than those deductions; shortfall = wallet promos and costs outweighed fee income.',
  estimatedRevenue:
    'What KoyaKart earns from the business model in this period (accrual): platform/delivery/COD fees on delivered orders, vendor commission, and membership. Not the same as cash in the bank today.',
  buyerRefunds:
    'Money sent back to buyers (online refunds, etc.) in this range. Reduces your result.',
  gatewayFees:
    'Fees charged by Razorpay (or similar) from settlement batches you imported on the Gateway tab. Zero here means none recorded for this range, not “no fees ever”.',
  platformCashIn:
    'Cash that hit the company bank book as platform income here—mainly membership and franchise/hub fees. Can differ from estimated revenue because of timing and what counts as cash book vs accrual.',
  passThroughFloat:
    'Buyer and hub money flowing through you minus payouts to vendors and agents for goods/delivery. This is others’ money, not platform profit.',
  netCashMovement:
    'Simple bank view: total money IN to bank minus total OUT in this range. Can be positive even when platform result is a shortfall, because pass-through and timing differ from profit.',
  walletGifts:
    'Total free wallet balance given to buyers (scratch, referral, cancel credit, etc.). Treat as a cost: buyers can spend it later. Not the same as cash leaving the bank on that day.',
  scratchGifts:
    'Wallet credits from scratch-card promotions in this range.',
  referralGifts:
    'Wallet credits for invite-a-friend rewards (referrer and referee when both get credit).',
  storeCredit:
    'Wallet credit when items or orders are cancelled—buyer gets wallet balance instead of cash back.',
} as const;
