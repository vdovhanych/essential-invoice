import { describe, it, expect } from 'vitest';

// Test the calculation logic (pure functions extracted for testing)
function calculateInvoice(hourlyRate: number, hoursWorked: number, kpiBonusPercent: number) {
  const kpiBonusHours = (hoursWorked * kpiBonusPercent) / 100;
  const kpiBonusAmount = hourlyRate * kpiBonusHours;
  const hoursTotal = hourlyRate * hoursWorked;
  const grandTotal = hoursTotal + kpiBonusAmount;

  return {
    kpiBonusHours,
    kpiBonusAmount,
    hoursTotal,
    grandTotal
  };
}

describe('Calculator Calculations', () => {
  it('should calculate correctly with basic values', () => {
    const result = calculateInvoice(500, 160, 10);

    expect(result.kpiBonusHours).toBe(16);
    expect(result.kpiBonusAmount).toBe(8000);
    expect(result.hoursTotal).toBe(80000);
    expect(result.grandTotal).toBe(88000);
  });

  it('should handle zero hours', () => {
    const result = calculateInvoice(500, 0, 10);

    expect(result.kpiBonusHours).toBe(0);
    expect(result.kpiBonusAmount).toBe(0);
    expect(result.hoursTotal).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  it('should handle zero KPI bonus', () => {
    const result = calculateInvoice(500, 160, 0);

    expect(result.kpiBonusHours).toBe(0);
    expect(result.kpiBonusAmount).toBe(0);
    expect(result.hoursTotal).toBe(80000);
    expect(result.grandTotal).toBe(80000);
  });

  it('should handle zero hourly rate', () => {
    const result = calculateInvoice(0, 160, 10);

    expect(result.kpiBonusHours).toBe(16);
    expect(result.kpiBonusAmount).toBe(0);
    expect(result.hoursTotal).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  it('should handle decimal values', () => {
    const result = calculateInvoice(750.50, 40.5, 15.5);

    // kpiBonusHours = 40.5 * 15.5 / 100 = 6.2775
    expect(result.kpiBonusHours).toBeCloseTo(6.2775, 4);
    // kpiBonusAmount = 750.50 * 6.2775 = 4711.26375
    expect(result.kpiBonusAmount).toBeCloseTo(4711.26, 1);
    // hoursTotal = 750.50 * 40.5 = 30395.25
    expect(result.hoursTotal).toBeCloseTo(30395.25, 2);
    // grandTotal = 30395.25 + 4711.26375 = 35106.51375
    expect(result.grandTotal).toBeCloseTo(35106.51, 1);
  });

  it('should calculate example from requirements: 600 Kc, 159.08h, 3% KPI', () => {
    const result = calculateInvoice(600, 159.08, 3);

    // KPI bonus hours = 159.08 * 3 / 100 = 4.7724
    expect(result.kpiBonusHours).toBeCloseTo(4.7724, 4);

    // KPI bonus amount = 600 * 4.7724 = 2863.44
    expect(result.kpiBonusAmount).toBeCloseTo(2863.44, 2);

    // Hours total = 600 * 159.08 = 95448
    expect(result.hoursTotal).toBeCloseTo(95448, 2);

    // Grand total = 95448 + 2863.44 = 98311.44
    expect(result.grandTotal).toBeCloseTo(98311.44, 2);
  });
});
