export type ReturnReason =
  | "Endommagé"
  | "Mauvais article"
  | "Choix du client"
  | "Autre";

export type StockDisposition = "Invendable" | "Disponible";

export type ReturnLine = {
  lineIndex: number;
  qtyReturned: number;
};

export type ReturnItemRow = {
  returnId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  productName: string;
  qtyReturned: number;
  unitPriceMad: number;
  lineRefundMad: number;
  reason: ReturnReason;
  stockDisposition: StockDisposition;
  createdAtIso: string;
  note: string | null;
};

export type ReturnRecord = {
  id: string;
  invoiceId: string;
  createdAtIso: string;
  reason: ReturnReason;
  stockDisposition: StockDisposition;
  lines: ReturnLine[];
  refundTotalMad: number;
  note?: string;
};

export type ReturnDetailLine = {
  lineIndex: number;
  qtyReturned: number;
  productName: string;
  unitPriceMad: number;
  lineRefundMad: number;
};

export type ReturnDetail = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string | null;
  clientName: string;
  createdAtIso: string;
  reason: ReturnReason;
  stockDisposition: StockDisposition;
  refundTotalMad: number;
  note: string | null;
  lines: ReturnDetailLine[];
};

export type ReturnableInvoiceSummary = {
  id: string;
  number: string;
  date: string;
  time: string;
  clientName: string;
  paymentType: "cash" | "credit";
  totalMad: number;
  returnableLinesCount: number;
  returnableProductNames: string[];
};

export type ReturnsStore = {
  returns: ReturnRecord[];
};

