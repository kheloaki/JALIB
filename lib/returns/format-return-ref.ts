/** Short display ref for a return record (matches POS ledger style). */
export function formatReturnRef(returnId: string): string {
  const tail = returnId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return tail ? `RT-${tail}` : "RT";
}
