import { describe, expect, it } from "vitest";

import { mergeInvoicesForPdf } from "@/lib/invoices/merge-invoices-for-pdf";
import type { Invoice } from "@/lib/invoices/types";

function cashInvoice(
  partial: Partial<Invoice> & {
    id: string;
    number: string;
    lines: Invoice["lines"];
    totalMad: number;
  },
): Invoice {
  return {
    barcode: "0000000000000",
    date: "2026-08-03",
    time: "10:00",
    clientName: "Client A",
    cashierId: "caisse",
    status: "paid",
    paymentType: "cash",
    paymentHistory: [
      {
        id: "p1",
        date: "2026-08-03",
        amountMad: partial.totalMad,
        note: "",
        ref: "CASH",
      },
    ],
    ...partial,
  } as Invoice;
}

function creditInvoice(
  partial: Partial<Invoice> & {
    id: string;
    number: string;
    lines: Invoice["lines"];
    totalMad: number;
    paymentHistory?: Invoice["paymentHistory"];
  },
): Invoice {
  return {
    barcode: "0000000000000",
    date: "2026-08-03",
    time: "10:00",
    clientName: "Client A",
    cashierId: "caisse",
    status: "pending",
    paymentType: "credit",
    paymentHistory: partial.paymentHistory ?? [],
    ...partial,
  } as Invoice;
}

describe("mergeInvoicesForPdf", () => {
  it("lists product lines in invoice time order (oldest first)", () => {
    const later = cashInvoice({
      id: "2",
      number: "101",
      time: "14:30",
      totalMad: 15,
      lines: [{ nameAr: "Pain", qty: 1, unitPriceMad: 15 }],
    });
    const earlier = cashInvoice({
      id: "1",
      number: "100",
      time: "09:15",
      totalMad: 10,
      lines: [{ nameAr: "Eau", qty: 2, unitPriceMad: 5 }],
    });

    const merged = mergeInvoicesForPdf([later, earlier]);
    const products = merged.lines.filter((l) => l.sourceKind !== "payment");
    expect(products.map((l) => l.nameAr)).toEqual(["Eau", "Pain"]);
    expect(merged.totalMad).toBe(25);
    expect(merged.number.startsWith("LOT-")).toBe(true);
  });

  it("keeps separate lines for the same product sold at different times", () => {
    const a = cashInvoice({
      id: "1",
      number: "100",
      time: "10:00",
      totalMad: 10,
      lines: [{ nameAr: "Eau", qty: 2, unitPriceMad: 5 }],
    });
    const b = cashInvoice({
      id: "2",
      number: "101",
      time: "11:00",
      totalMad: 15,
      lines: [{ nameAr: "Eau", qty: 3, unitPriceMad: 5 }],
    });

    const merged = mergeInvoicesForPdf([a, b]);
    const products = merged.lines.filter((l) => l.sourceKind !== "payment");
    expect(products).toHaveLength(2);
    expect(products[0]?.qty).toBe(2);
    expect(products[1]?.qty).toBe(3);
    expect(products[0]?.sourceInvoiceNumber).toBe("100");
    expect(products[1]?.sourceInvoiceNumber).toBe("101");
    expect(products[0]?.sourceInvoiceTotalMad).toBe(10);
  });

  it("inserts recouvrement lines after purchases by date", () => {
    const a = creditInvoice({
      id: "1",
      number: "100",
      date: "2026-08-01",
      time: "10:00",
      totalMad: 100,
      lines: [{ nameAr: "Sac", qty: 1, unitPriceMad: 100 }],
      paymentHistory: [
        {
          id: "pay-1",
          date: "2026-08-02",
          amountMad: 40,
          note: "Acompte",
          ref: "PAY-1",
        },
      ],
    });
    const b = creditInvoice({
      id: "2",
      number: "101",
      date: "2026-08-03",
      time: "11:00",
      totalMad: 50,
      lines: [{ nameAr: "Huile", qty: 1, unitPriceMad: 50 }],
      paymentHistory: [],
    });

    const merged = mergeInvoicesForPdf([b, a]);
    const kinds = merged.lines.map((l) => l.sourceKind ?? "product");
    expect(kinds).toEqual(["product", "payment", "product"]);
    expect(merged.lines[1]?.sourcePaymentAmountMad).toBe(40);
    expect(merged.lines[1]?.sourceInvoiceDate).toBe("2026-08-02");
  });

  it("includes client ledger versements not linked to a facture", () => {
    const a = creditInvoice({
      id: "1",
      number: "100",
      date: "2026-08-01",
      time: "10:00",
      totalMad: 100,
      lines: [{ nameAr: "Sac", qty: 1, unitPriceMad: 100 }],
      paymentHistory: [],
    });
    const b = creditInvoice({
      id: "2",
      number: "101",
      date: "2026-08-03",
      time: "11:00",
      totalMad: 50,
      lines: [{ nameAr: "Huile", qty: 1, unitPriceMad: 50 }],
      paymentHistory: [],
    });
    const merged = mergeInvoicesForPdf([a, b], {
      ledgerMovements: [
        {
          id: "led-1",
          date: "2026-08-02",
          amountMad: 40,
          note: "Versement",
          ref: "Paiement #PY-ABC123",
          kind: "payment",
        },
      ],
    });
    const kinds = merged.lines.map((l) => l.sourceKind ?? "product");
    expect(kinds).toEqual(["product", "payment", "product"]);
    expect(merged.lines[1]?.nameAr).toContain("Versement");
    expect(merged.lines[1]?.sourcePaymentAmountMad).toBe(40);
  });

  it("builds a ledger-only relevé when there are no invoices", () => {
    const merged = mergeInvoicesForPdf([], {
      openingBalanceMad: 100,
      clientName: "Client Test",
      ledgerMovements: [
        {
          id: "led-pay",
          date: "2026-08-01",
          amountMad: 40,
          note: "Versement",
          ref: "Paiement #PY-1",
          kind: "payment",
        },
      ],
    });
    expect(merged.clientName).toBe("Client Test");
    expect(merged.statementOpeningBalanceMad).toBe(100);
    expect(merged.number.startsWith("LOT-")).toBe(true);
    expect(merged.lines).toHaveLength(1);
    expect(merged.lines[0]?.sourceKind).toBe("payment");
  });

  it("uses gross facture total so returns are not double-counted", () => {
    const a = creditInvoice({
      id: "1",
      number: "100",
      date: "2026-05-09",
      time: "10:00",
      // Net after return (Lessive fully returned).
      totalMad: 14.5,
      lines: [
        { nameAr: "Lessive", qty: 1, unitPriceMad: 115, returnedQty: 1 },
        { nameAr: "Bananes", qty: 1, unitPriceMad: 14.5 },
      ],
      paymentHistory: [
        {
          id: "ret-1",
          date: "2026-05-09",
          amountMad: 115,
          note: "Retour 100",
          ref: "Retour #RT-Y9U0FI",
        },
      ],
    });
    const b = creditInvoice({
      id: "2",
      number: "101",
      date: "2026-05-17",
      time: "11:00",
      totalMad: 5,
      lines: [{ nameAr: "LMA", qty: 1, unitPriceMad: 5 }],
    });
    const merged = mergeInvoicesForPdf([a, b]);
    const lessiveGroup = merged.lines.find((l) => l.nameAr === "Lessive");
    expect(lessiveGroup?.sourceInvoiceTotalMad).toBe(129.5);
    expect(merged.lines.some((l) => l.sourceKind === "return")).toBe(true);
  });

  it("carries opening balance for running solde", () => {
    const a = creditInvoice({
      id: "1",
      number: "100",
      date: "2026-08-01",
      time: "10:00",
      totalMad: 100,
      lines: [{ nameAr: "Sac", qty: 1, unitPriceMad: 100 }],
    });
    const b = creditInvoice({
      id: "2",
      number: "101",
      date: "2026-08-02",
      time: "11:00",
      totalMad: 50,
      lines: [{ nameAr: "Huile", qty: 1, unitPriceMad: 50 }],
    });
    const merged = mergeInvoicesForPdf([a, b], { openingBalanceMad: 200 });
    expect(merged.statementOpeningBalanceMad).toBe(200);
    expect(merged.lines.some((l) => l.sourceInvoiceTotalMad === 100)).toBe(
      true,
    );
  });

  it("tags retour ledger lines as return (not payment)", () => {
    const a = creditInvoice({
      id: "1",
      number: "100",
      date: "2026-08-01",
      time: "10:00",
      totalMad: 100,
      lines: [{ nameAr: "Sac", qty: 1, unitPriceMad: 100 }],
      paymentHistory: [
        {
          id: "pay-1",
          date: "2026-08-02",
          amountMad: 40,
          note: "Acompte",
          ref: "PAY-1",
        },
        {
          id: "ret-1",
          date: "2026-08-03",
          amountMad: 25,
          note: "Retour 100",
          ref: "Retour #RT-ABC123",
        },
      ],
    });

    const merged = mergeInvoicesForPdf([
      a,
      creditInvoice({
        id: "2",
        number: "101",
        date: "2026-08-04",
        time: "11:00",
        totalMad: 10,
        lines: [{ nameAr: "Eau", qty: 1, unitPriceMad: 10 }],
        paymentHistory: [],
      }),
    ]);
    const kinds = merged.lines.map((l) => l.sourceKind ?? "product");
    expect(kinds).toContain("payment");
    expect(kinds).toContain("return");
    const retour = merged.lines.find((l) => l.sourceKind === "return");
    expect(retour?.sourcePaymentAmountMad).toBe(25);
    expect(retour?.nameAr).toContain("Retour");
  });
});
