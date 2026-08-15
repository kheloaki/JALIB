import type { Client } from "@/lib/clients/types";
import type { CreditStore, LedgerEntry } from "@/lib/credits/types";

/** Clients de démo (Stitch « Gestion des Crédits ») — affichés si aucun client enregistré. */
export const CREDITS_DEMO_CLIENT_IDS = {
  abdellah: "credit-demo-abdellah",
  karim: "credit-demo-karim",
  meryem: "credit-demo-meryem",
  omar: "credit-demo-omar",
} as const;

export const CREDITS_DEMO_CLIENTS: Client[] = [
  {
    id: CREDITS_DEMO_CLIENT_IDS.abdellah,
    fullName: "Abdellah Mansouri",
    phone: "06 61 22 33 44",
    isCashOnly: false,
    creditLimitMad: 4000,
    initialSoldeMad: 0,
  },
  {
    id: CREDITS_DEMO_CLIENT_IDS.karim,
    fullName: "Karim Benali",
    phone: "06 50 11 22 33",
    isCashOnly: true,
    creditLimitMad: null,
    initialSoldeMad: 0,
  },
  {
    id: CREDITS_DEMO_CLIENT_IDS.meryem,
    fullName: "Meryem Idrissi",
    phone: "06 77 88 99 00",
    isCashOnly: false,
    creditLimitMad: 5000,
    initialSoldeMad: 0,
  },
  {
    id: CREDITS_DEMO_CLIENT_IDS.omar,
    fullName: "Omar Zahidi",
    phone: "06 65 44 33 22",
    isCashOnly: false,
    creditLimitMad: 2000,
    initialSoldeMad: 0,
  },
];

/** Avatar Stitch — fiche client détail. */
export const CREDITS_PROFILE_IMAGE_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA76M5XmioAB9Mzvx419F9mN6a83hroHfbouaYrbBYz14u9BF5hM-tYAI_wcMLzacZ3eOJS_LETIiB2Fy4QAVoqck4kyjeXnVwKE4p_-3d4YWDEadw9CbQcsnulgbVtnl1e8ZrvtMq4j3UMMOBInH6HRPw7Ts60BPYWyE_e8_mA_mrTwnrfiqjcpZTiiWVKhNv-8OG-diiBxALea5LWCCCUiLjCvUHtr_FtdNNwb_e-JPkwl3NJvaaV9Mj2rOTmz2NEpBXN4zQv-9eV";

function entry(
  partial: Omit<LedgerEntry, "id" | "clientId"> & { clientId: string },
): LedgerEntry {
  return {
    ...partial,
    id: `leg:${crypto.randomUUID()}`,
  };
}

/** Données initiales alignées sur la maquette Stitch (Abdellah). */
function abdellahLedger(): LedgerEntry[] {
  const cid = CREDITS_DEMO_CLIENT_IDS.abdellah;
  return [
    entry({
      clientId: cid,
      kind: "payment",
      date: "2024-05-24",
      ref: "Paiement #PY-902",
      note: "Versement espèces",
      amountMad: 400,
      status: "valide",
    }),
    entry({
      clientId: cid,
      kind: "invoice",
      date: "2024-05-20",
      ref: "Facture #FT-4423",
      note: "Articles divers épicerie",
      amountMad: 1300,
      status: "impayé",
    }),
    entry({
      clientId: cid,
      kind: "payment",
      date: "2024-05-15",
      ref: "Paiement #PY-855",
      note: "Versement espèces",
      amountMad: 800,
      status: "valide",
    }),
    entry({
      clientId: cid,
      kind: "invoice",
      date: "2024-05-12",
      ref: "Facture #FT-4102",
      note: "Achats ramadan",
      amountMad: 1200,
      status: "solde",
    }),
  ];
}

function karimLedger(): LedgerEntry[] {
  return [];
}

function meryemLedger(): LedgerEntry[] {
  const cid = CREDITS_DEMO_CLIENT_IDS.meryem;
  return [
    entry({
      clientId: cid,
      kind: "invoice",
      date: "2024-05-18",
      ref: "Facture #FT-4490",
      note: "Courses mensuelles",
      amountMad: 5300.5,
      status: "impayé",
    }),
    entry({
      clientId: cid,
      kind: "payment",
      date: "2024-05-10",
      ref: "Paiement #PY-801",
      note: "Virement",
      amountMad: 1050,
      status: "valide",
    }),
  ];
}

function omarLedger(): LedgerEntry[] {
  const cid = CREDITS_DEMO_CLIENT_IDS.omar;
  return [
    entry({
      clientId: cid,
      kind: "invoice",
      date: "2024-05-22",
      ref: "Facture #FT-4481",
      note: "Épicerie",
      amountMad: 850,
      status: "impayé",
    }),
  ];
}

export function createSeededCreditStore(): CreditStore {
  return {
    entriesByClient: {
      [CREDITS_DEMO_CLIENT_IDS.abdellah]: abdellahLedger(),
      [CREDITS_DEMO_CLIENT_IDS.karim]: karimLedger(),
      [CREDITS_DEMO_CLIENT_IDS.meryem]: meryemLedger(),
      [CREDITS_DEMO_CLIENT_IDS.omar]: omarLedger(),
    },
  };
}
