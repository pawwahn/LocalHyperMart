import { describe, expect, it } from 'vitest';
import { isVendorVisibleDiagnosticsBooking } from './diagnosticsApi';

describe('isVendorVisibleDiagnosticsBooking', () => {
  it('shows cash on delivery even before cash is collected', () => {
    expect(isVendorVisibleDiagnosticsBooking({ paymentMethod: 'COD', paymentStatus: 'PENDING' })).toBe(true);
    expect(isVendorVisibleDiagnosticsBooking({ paymentMethod: 'CASH', paymentStatus: 'PENDING' })).toBe(true);
  });

  it('shows online bookings only after they are paid', () => {
    expect(isVendorVisibleDiagnosticsBooking({ paymentMethod: 'UPI', paymentStatus: 'PAID' })).toBe(true);
    expect(isVendorVisibleDiagnosticsBooking({ paymentMethod: 'ONLINE', paymentStatus: 'COLLECTED' })).toBe(true);
  });

  it('hides online payment pending and failed', () => {
    expect(isVendorVisibleDiagnosticsBooking({ paymentMethod: 'UPI', paymentStatus: 'PENDING' })).toBe(false);
    expect(isVendorVisibleDiagnosticsBooking({ paymentMethod: 'ONLINE', paymentStatus: 'FAILED' })).toBe(false);
    expect(isVendorVisibleDiagnosticsBooking({ paymentMethod: 'UPI', paymentStatus: '' })).toBe(false);
  });
});
