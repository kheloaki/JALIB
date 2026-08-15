export function computeEan13CheckDigit(payload12: string): string {
  if (!/^\d{12}$/.test(payload12)) {
    throw new Error("EAN-13 payload must be 12 digits");
  }
  let sum = 0;
  for (let i = 0; i < payload12.length; i += 1) {
    const digit = Number.parseInt(payload12[i]!, 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function generateInvoiceBarcode(sequence: number): string {
  const safeSeq = Math.max(1, Math.floor(sequence));
  const payload = `209${String(safeSeq).padStart(9, "0")}`;
  return `${payload}${computeEan13CheckDigit(payload)}`;
}
