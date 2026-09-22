import type { InventoryProduct, InventoryVariant } from "../inventory/types";

export type CustomerType = "general" | "wholesale";
export const customerTypeLabels: Record<CustomerType, string> = {
  general: "General Member / Customer",
  wholesale: "Wholesale Customer",
};

export function inventoryPrice(product: Pick<InventoryProduct, "selling_price_minor" | "wholesale_price_minor">, variant: Pick<InventoryVariant, "selling_price_minor" | "wholesale_price_minor">, customerType: CustomerType) {
  const price = customerType === "wholesale"
    ? variant.wholesale_price_minor ?? product.wholesale_price_minor
    : variant.selling_price_minor ?? product.selling_price_minor;
  if (!Number.isSafeInteger(price) || price < 0) throw new Error("This product has an invalid price. Update it in Inventory first.");
  return price;
}

export function validBillNumber(value: string) {
  return !value.trim() || /^[A-Za-z0-9/_-]{1,64}$/.test(value.trim());
}

// Inventory uses the existing two-decimal minor-unit storage.
export function inventoryPriceToMinor(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}
