import { describe, expect, it } from "vitest";
import { inventoryPrice, inventoryPriceToMinor, validBillNumber } from "./pricing";

describe("inventory pricing", () => {
  const product = { selling_price_minor: 15000, wholesale_price_minor: 10000 };
  const inherited = { selling_price_minor: null, wholesale_price_minor: null };
  it("selects the requested product price", () => {
    expect(inventoryPrice(product, inherited, "general")).toBe(15000);
    expect(inventoryPrice(product, inherited, "wholesale")).toBe(10000);
  });
  it("uses independent variant overrides including zero", () => {
    const variant = { selling_price_minor: 19000, wholesale_price_minor: 0 };
    expect(inventoryPrice(product, variant, "general")).toBe(19000);
    expect(inventoryPrice(product, variant, "wholesale")).toBe(0);
    expect(inventoryPrice(product, { ...variant, wholesale_price_minor: null }, "wholesale")).toBe(10000);
  });
  it("does not change an applied price after a catalog edit", () => {
    const catalog = { ...product };
    const savedLine = { customerType: "wholesale", unitPriceMinor: inventoryPrice(catalog, inherited, "wholesale") };
    catalog.wholesale_price_minor = 20000;
    expect(savedLine).toEqual({ customerType: "wholesale", unitPriceMinor: 10000 });
    expect(inventoryPrice(catalog, inherited, "wholesale")).toBe(20000);
  });
  it.each([-1, Infinity, NaN, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid catalog price %s", (price) => {
    expect(() => inventoryPrice({ ...product, wholesale_price_minor: price }, inherited, "wholesale")).toThrow();
  });
  it.each(["", " ", "-1", "NaN", "Infinity", "1.234", "1e4", "90071992547409.92"])("rejects invalid price input %s", (value) => expect(inventoryPriceToMinor(value)).toBeNull());
  it("parses decimal amounts exactly", () => {
    expect(inventoryPriceToMinor("0")).toBe(0);
    expect(inventoryPriceToMinor(" 12.30 ")).toBe(1230);
    expect(inventoryPriceToMinor("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("manual bill numbers", () => {
  it.each(["", "  ", "  INV-2026/42  ", "0042", "GYM_1", "-GYM-2026-000001"])("accepts %s", (value) => expect(validBillNumber(value)).toBe(true));
  it.each(["a".repeat(65), "#42", "Bill 42", "<script>", "A\nB"])("rejects %s", (value) => expect(validBillNumber(value)).toBe(false));
});
