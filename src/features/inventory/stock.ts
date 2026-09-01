export function applyStockChange(current: number, delta: number, allowNegative = false) {
  if (!Number.isFinite(current) || !Number.isFinite(delta) || delta === 0) throw new Error("Invalid stock movement");
  const result = current + delta;
  if (!allowNegative && result < 0) throw new Error("Insufficient stock");
  return result;
}

export function reverseStockSale(current: number, soldQuantity: number) {
  if (soldQuantity <= 0) throw new Error("Invalid sale quantity");
  return current + soldQuantity;
}

