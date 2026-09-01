import { describe, expect, it } from "vitest";
import { applyStockChange, reverseStockSale } from "./stock";

describe("stock movement rules", () => {
  it("increases and decreases stock", () => { expect(applyStockChange(5, 3)).toBe(8); expect(applyStockChange(5, -2)).toBe(3); });
  it("prevents insufficient stock by default", () => { expect(() => applyStockChange(1, -2)).toThrow("Insufficient stock"); });
  it("can allow negative inventory only when explicitly enabled", () => { expect(applyStockChange(1, -2, true)).toBe(-1); });
  it("reverses a sale on cancellation", () => { expect(reverseStockSale(2, 3)).toBe(5); });
  it("rejects invalid or zero movements", () => { expect(() => applyStockChange(2, 0)).toThrow(); expect(() => reverseStockSale(2, 0)).toThrow(); });
});
