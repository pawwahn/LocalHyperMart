import { describe, expect, it } from 'vitest';
import { beautyPaymentPlanView } from '@hlm-beauty';

describe('beautyPaymentPlanView', () => {
  it('labels full UPI booking when entire amount paid online', () => {
    const view = beautyPaymentPlanView({
      prepayMode: 'FULL',
      paymentMethod: 'UPI',
      paymentStatus: 'COLLECTED',
      amountDueTotal: 781,
      amountCollected: 781,
      balanceDue: 0,
      parlourPaymentFee: 0,
    });
    expect(view.plan).toBe('FULL');
    expect(view.planBadge).toBe('Full payment');
    expect(view.settlementBadge).toBe('Paid in full online');
  });

  it('labels partial prepay even when balance is cleared', () => {
    const view = beautyPaymentPlanView({
      prepayMode: 'PARTIAL',
      paymentMethod: 'UPI',
      paymentStatus: 'COLLECTED',
      amountDueTotal: 781,
      amountCollected: 781,
      balanceDue: 0,
      prepayAmount: 200,
      parlourPaymentFee: 30,
    });
    expect(view.plan).toBe('PARTIAL');
    expect(view.settlementBadge).toBe('All paid online');
    expect(view.planDescription).toContain('Nothing to pay at the visit');
  });

  it('shows balance due for partial prepay', () => {
    const view = beautyPaymentPlanView({
      prepayMode: 'PARTIAL',
      paymentMethod: 'UPI',
      paymentStatus: 'PARTIAL',
      amountDueTotal: 781,
      amountCollected: 200,
      balanceDue: 581,
      prepayAmount: 200,
      parlourPaymentFee: 30,
    });
    expect(view.dueAtVisit).toBe(581);
    expect(view.settlementBadge).toBe('₹581 due at visit');
  });

  it('shows ₹50 paid and balance for min prepay only', () => {
    const view = beautyPaymentPlanView({
      prepayMode: 'PARTIAL',
      paymentMethod: 'UPI',
      paymentStatus: 'PARTIAL',
      amountDueTotal: 781,
      amountCollected: 50,
      balanceDue: 731,
      prepayAmount: 50,
      parlourPaymentFee: 30,
    });
    expect(view.paidOnline).toBe(50);
    expect(view.dueAtVisit).toBe(731);
    expect(view.settlementBadge).toBe('₹731 due at visit');
    expect(view.plan).toBe('PARTIAL');
  });
});
