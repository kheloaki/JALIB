import { createPosMiscLineId } from "@/components/pos/constants";
import type { CartLine, PaymentMethod } from "@/components/pos/types";
import type { Id } from "@/convex/_generated/dataModel";

export type PosCartDraftView = {
  id: Id<"posCartDrafts">;
  label: string;
  payment: PaymentMethod;
  clientId: Id<"clients"> | null;
  clientNameSnapshot: string | null;
  lines: Array<{
    productId: Id<"products"> | null;
    name: string;
    unitPriceMad: number;
    qty: number;
    image: string | null;
    imageAlt: string | null;
    soldByWeight?: boolean;
  }>;
  totalMad: number;
  itemCount: number;
  createdByUserName: string | null;
  parkedByAssist: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RestoredPosCartDraft = Omit<
  PosCartDraftView,
  "id" | "createdAt" | "updatedAt"
>;

export function draftLinesToCartLines(
  lines: RestoredPosCartDraft["lines"],
): CartLine[] {
  return lines.map((line) => ({
    productId: line.productId ?? createPosMiscLineId(),
    name: line.name,
    unitPrice: line.unitPriceMad,
    qty: line.qty,
    ...(line.image ? { image: line.image } : {}),
    ...(line.imageAlt ? { imageAlt: line.imageAlt } : {}),
    ...(line.soldByWeight ? { soldByWeight: true } : {}),
  }));
}

export function buildAssistDraftLabel(input: {
  clientName?: string | null;
  aideName: string;
  tr: (fr: string, ar: string) => string;
}): string {
  const client = input.clientName?.trim();
  if (client) return client;
  const aide = input.aideName.trim();
  if (aide) return aide;
  return input.tr("Aide caissier", "مساعد الصندوق");
}

export function buildDefaultDraftLabel(input: {
  clientName?: string | null;
  lines: CartLine[];
  tr: (fr: string, ar: string) => string;
}): string {
  const { clientName, lines, tr } = input;
  if (clientName?.trim()) return clientName.trim();
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const first = lines[0]?.name;
  if (first) {
    return `${first} · ${count} ${tr("art.", "صنف")}`;
  }
  return tr("Panier en attente", "سلة معلّقة");
}
