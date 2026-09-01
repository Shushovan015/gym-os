import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, paymentStatus } from "./calculations";
import type { DraftLine } from "./types";

const line = (overrides: Partial<DraftLine> = {}): DraftLine => ({
  key: "1", itemType: "product", productId: 1, variantId: 1, description: "Snapshot name",
  quantity: 2, unitPriceMinor: 250_00, discountMinor: 0, ...overrides,
});

describe("invoice calculations", () => {
  it("calculates integer totals without tax", () => {
    expect(calculateInvoiceTotals([line()], 0, false, 0)).toEqual({ subtotalMinor: 50000, discountMinor: 0, taxMinor: 0, totalMinor: 50000 });
  });
  it("applies line and invoice discounts before tax", () => {
    expect(calculateInvoiceTotals([line({ discountMinor: 2_000 })], 3_000, true, 1300)).toEqual({ subtotalMinor: 50000, discountMinor: 5000, taxMinor: 5850, totalMinor: 50850 });
  });
  it("caps discounts so totals never become negative", () => {
    expect(calculateInvoiceTotals([line()], 999_999, false, 0).totalMinor).toBe(0);
  });
  it("derives partial and completed payment states", () => {
    expect(paymentStatus(10000, 0)).toBe("unpaid");
    expect(paymentStatus(10000, 4000)).toBe("partially_paid");
    expect(paymentStatus(10000, 10000)).toBe("paid");
  });
  it("keeps invoice snapshot prices independent of later catalog prices", () => {
    const snapshot = line({ unitPriceMinor: 120_00 }); const changedCatalogPrice = 180_00;
    expect(calculateInvoiceTotals([snapshot], 0, false, 0).totalMinor).toBe(240_00);
    expect(changedCatalogPrice).not.toBe(snapshot.unitPriceMinor);
  });
});

