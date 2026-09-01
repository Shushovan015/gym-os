export function formatMoney(minor: number, currency = "NPR", minorUnit = 2) {
  return new Intl.NumberFormat("en-NP", { style: "currency", currency, minimumFractionDigits: minorUnit }).format(minor / 10 ** minorUnit);
}

export function majorToMinor(value: string, minorUnit = 2) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 10 ** minorUnit);
}

export function minorToInput(value: number, minorUnit = 2) {
  return (value / 10 ** minorUnit).toFixed(minorUnit);
}

