import {
  formatDateFr,
  formatNowDateTimeFr,
} from "@/lib/dates/format-date";

export type DocumentLocale = "fr" | "ar";

export type DocumentLabels = {
  locale: DocumentLocale;
  dir: "ltr" | "rtl";
  lang: DocumentLocale;
  dateLocale: string;
  phonePrefix: string;
  icePrefix: string;
  ifPrefix: string;
  rcPrefix: string;
  atTime: string;
  ttc: string;
  currencyWord: string;
  invoice: {
    title: string;
    client: string;
    cashier: string;
    paymentType: string;
    status: string;
    cash: string;
    credit: string;
    paid: string;
    pending: string;
    returned: string;
    grossAmount: string;
    collected: string;
    netTtc: string;
    grossSold: string;
    returns: string;
    balanceDue: string;
    remainingDue: string;
    /** Running client balance label in merged statement PDFs. */
    runningBalance: string;
    /** Opening balance row (initial solde + prior) in merged statement PDFs. */
    openingBalance: string;
    /** Payment / collection row in merged statement PDFs. */
    recouvrement: string;
    /** Ledger-style columns for merged client statement PDFs. */
    statementDate: string;
    statementDesignation: string;
    statementQty: string;
    statementUnitPrice: string;
    statementDebit: string;
    statementCredit: string;
    lineIndex: string;
    designation: string;
    qtySold: string;
    qtyReturned: string;
    netQty: string;
    unitPrice: string;
    lineTotal: string;
    totalNet: (qty: number) => string;
    articleOne: string;
    articleMany: string;
    payments: string;
    paymentDate: string;
    paymentNote: string;
    paymentRef: string;
    paymentAmount: string;
    internalFooter: (issuedOn: string, invoiceNumber: string) => string;
    internalFooterArabicLine: string;
    internalFooterMetaLine: (issuedOn: string, invoiceNumber: string) => string;
    clientCopyTitle: string;
    invoiceNumber: string;
    dateTime: string;
    customer: string;
    payment: string;
    details: string;
    returnedQty: (n: number) => string;
    totalTtc: string;
    paidLabel: string;
    remainingLabel: string;
    paymentHistory: string;
  };
  credit: {
    title: string;
    issuedOn: (date: string) => string;
    client: string;
    phone: string;
    creditLimit: string;
    cashOnly: string;
    noLimit: string;
    totalDebt: string;
    totalPaid: string;
    returns: string;
    balanceDue: string;
    historyTitle: string;
    colDate: string;
    colType: string;
    colRef: string;
    colNote: string;
    colAmount: string;
    colStatus: string;
    kindInvoice: string;
    kindPayment: string;
    kindReturn: string;
    statusValid: string;
    statusUnpaid: string;
    statusSettled: string;
    noEntries: string;
    footer: (clientName: string, balance: string) => string;
  };
  procurement: {
    defaultTitle: string;
    listStatusActive: string;
    listStatusCompleted: string;
    publishedAt: (date: string) => string;
    totalPartial: string;
    colIndex: string;
    colDesignation: string;
    colCategory: string;
    colQty: string;
    colUnitCost: string;
    colUnitSell: string;
    colLineTotal: string;
    colStatus: string;
    summary: (
      lines: number,
      qty: number,
      purchase: string,
      sell: string,
    ) => string;
    pending: string;
    bought: string;
  };
  stock: {
    filter: (label: string) => string;
    search: (query: string) => string;
    searchEmpty: string;
    references: (n: number) => string;
    lowStock: (n: number) => string;
    sellValuation: (v: string) => string;
    costValuation: (v: string) => string;
    colProduct: string;
    colCategory: string;
    colBarcode: string;
    colCost: string;
    colSell: string;
    colMargin: string;
    colStock: string;
  };
};

const FR: Omit<DocumentLabels, "locale" | "dir" | "lang" | "dateLocale"> = {
  phonePrefix: "Tél.",
  icePrefix: "ICE :",
  ifPrefix: "IF :",
  rcPrefix: "RC :",
  atTime: "à",
  ttc: "TTC",
  currencyWord: "DH",
  invoice: {
    title: "Facture",
    client: "Client",
    cashier: "Caissier",
    paymentType: "Mode de paiement",
    status: "Statut",
    cash: "Espèces",
    credit: "Crédit",
    paid: "Payée",
    pending: "En attente",
    returned: "Retournée",
    grossAmount: "Montant brut",
    collected: "Montant encaissé",
    netTtc: "Net TTC",
    grossSold: "Montant brut vendu",
    returns: "Retours",
    balanceDue: "Solde restant dû",
    remainingDue: "Reste dû",
    runningBalance: "Solde",
    openingBalance: "Solde initial",
    recouvrement: "Recouvrement",
    statementDate: "Date",
    statementDesignation: "Désignation",
    statementQty: "Qté",
    statementUnitPrice: "P.U.",
    statementDebit: "Débit",
    statementCredit: "Crédit",
    lineIndex: "N°",
    designation: "Désignation",
    qtySold: "Qté vendue",
    qtyReturned: "Retours",
    netQty: "Qté nette",
    unitPrice: "P.U. (MAD)",
    lineTotal: "Total (MAD)",
    totalNet: (qty) =>
      `Total net (${qty} article${qty > 1 ? "s" : ""})`,
    articleOne: "article",
    articleMany: "articles",
    payments: "Encaissements",
    paymentDate: "Date",
    paymentNote: "Libellé",
    paymentRef: "Référence",
    paymentAmount: "Montant (MAD)",
    internalFooter: (issuedOn, invoiceNumber) =>
      `Document interne à conserver pour la comptabilité. Émis le ${issuedOn}. Facture n° ${invoiceNumber}. Aucune vente dupliquée.`,
    internalFooterArabicLine: "",
    internalFooterMetaLine: (issuedOn, invoiceNumber) =>
      `Document interne à conserver pour la comptabilité. Émis le ${issuedOn}. Facture n° ${invoiceNumber}. Aucune vente dupliquée.`,
    clientCopyTitle: "Copie client",
    invoiceNumber: "N° facture",
    dateTime: "Date et heure",
    customer: "Client",
    payment: "Paiement",
    details: "Détail",
    returnedQty: (n) => `retours ${n}`,
    totalTtc: "Total TTC",
    paidLabel: "Payé",
    remainingLabel: "Reste dû",
    paymentHistory: "Historique des paiements",
  },
  credit: {
    title: "RELEVÉ DE COMPTE CLIENT",
    issuedOn: (date) => `Émis le ${date}`,
    client: "Client",
    phone: "Téléphone",
    creditLimit: "Limite crédit",
    cashOnly: "Comptant uniquement",
    noLimit: "Sans plafond",
    totalDebt: "Dette totale",
    totalPaid: "Total payé",
    returns: "Retours",
    balanceDue: "Reste à payer",
    historyTitle: "HISTORIQUE DES ÉCRITURES",
    colDate: "Date",
    colType: "Type",
    colRef: "Référence",
    colNote: "Note",
    colAmount: "Montant",
    colStatus: "Statut",
    kindInvoice: "Facture / dette",
    kindPayment: "Paiement",
    kindReturn: "Retour",
    statusValid: "Validé",
    statusUnpaid: "Impayée",
    statusSettled: "Soldé",
    noEntries: "Aucune écriture enregistrée",
    footer: (clientName, balance) =>
      `Relevé de compte client — ${clientName}. Document interne à conserver. Solde restant dû : ${balance}.`,
  },
  procurement: {
    defaultTitle: "Bon de liste d'achats",
    listStatusActive: "En cours",
    listStatusCompleted: "Clôturée",
    publishedAt: (date) => `Publiée le ${date}`,
    totalPartial: "— (prix manquants)",
    colIndex: "#",
    colDesignation: "Désignation",
    colCategory: "Catégorie",
    colQty: "Qté",
    colUnitCost: "P.U. achat",
    colUnitSell: "P.U. vente",
    colLineTotal: "Total achat",
    colStatus: "Statut",
    summary: (lines, qty, purchase, sell) =>
      `Articles : ${lines}  •  Qté totale : ${qty}  •  Total achat : ${purchase}  •  Total vente : ${sell}`,
    pending: "À acheter",
    bought: "Acheté",
  },
  stock: {
    filter: (label) => `Filtre : ${label}`,
    search: (query) => `Recherche : ${query}`,
    searchEmpty: "Recherche : —",
    references: (n) => `Références : ${n}`,
    lowStock: (n) => `Alertes stock : ${n}`,
    sellValuation: (v) => `Valorisation vente : ${v}`,
    costValuation: (v) => `Coût stock : ${v}`,
    colProduct: "Produit",
    colCategory: "Catégorie",
    colBarcode: "Code-barres",
    colCost: "Prix achat",
    colSell: "Prix vente",
    colMargin: "Marge",
    colStock: "Stock",
  },
};

const AR: Omit<DocumentLabels, "locale" | "dir" | "lang" | "dateLocale"> = {
  phonePrefix: "هاتف:",
  icePrefix: "ICE:",
  ifPrefix: "IF:",
  rcPrefix: "RC:",
  atTime: "في",
  ttc: "شامل الضريبة",
  currencyWord: "درهم",
  invoice: {
    title: "فاتورة",
    client: "الزبون",
    cashier: "أمين الصندوق",
    paymentType: "طريقة الدفع",
    status: "الحالة",
    cash: "نقدًا",
    credit: "آجل",
    paid: "مدفوعة",
    pending: "قيد الانتظار",
    returned: "مرتجعة",
    grossAmount: "المبلغ الإجمالي",
    collected: "المبلغ المحصّل",
    netTtc: "الصافي شامل الضريبة",
    grossSold: "إجمالي المبيعات",
    returns: "المرتجعات",
    balanceDue: "الرصيد المتبقي",
    remainingDue: "المتبقي",
    runningBalance: "الرصيد",
    openingBalance: "الرصيد الافتتاحي",
    recouvrement: "تحصيل",
    statementDate: "التاريخ",
    statementDesignation: "البيان",
    statementQty: "الكمية",
    statementUnitPrice: "س.و.",
    statementDebit: "مدين",
    statementCredit: "دائن",
    lineIndex: "م",
    designation: "الصنف",
    qtySold: "الكمية المباعة",
    qtyReturned: "المرتجعات",
    netQty: "الكمية الصافية",
    unitPrice: "س.و. (درهم)",
    lineTotal: "المجموع (درهم)",
    totalNet: (qty) => `المجموع الصافي (${qty} صنف)`,
    articleOne: "صنف",
    articleMany: "أصناف",
    payments: "التحصيلات",
    paymentDate: "التاريخ",
    paymentNote: "البيان",
    paymentRef: "المرجع",
    paymentAmount: "المبلغ (درهم)",
    internalFooter: (issuedOn, invoiceNumber) =>
      `وثيقة داخلية للمحاسبة. صدرت في ${issuedOn}. فاتورة رقم ${invoiceNumber}.`,
    internalFooterArabicLine: "وثيقة داخلية للمحاسبة.",
    internalFooterMetaLine: (issuedOn, invoiceNumber) =>
      `${issuedOn} · #${invoiceNumber}`,
    clientCopyTitle: "نسخة الزبون",
    invoiceNumber: "رقم الفاتورة",
    dateTime: "التاريخ والوقت",
    customer: "الزبون",
    payment: "الدفع",
    details: "التفاصيل",
    returnedQty: (n) => `مرتجع: ${n}`,
    totalTtc: "المجموع شامل الضريبة",
    paidLabel: "المدفوع",
    remainingLabel: "المتبقي",
    paymentHistory: "سجل الدفعات",
  },
  credit: {
    title: "كشف حساب الزبون",
    issuedOn: (date) => `صدر في ${date}`,
    client: "الزبون",
    phone: "الهاتف",
    creditLimit: "سقف الائتمان",
    cashOnly: "نقدي فقط",
    noLimit: "بدون سقف",
    totalDebt: "إجمالي الدين",
    totalPaid: "إجمالي المدفوع",
    returns: "المرتجعات",
    balanceDue: "المتبقي للأداء",
    historyTitle: "سجل الحركات",
    colDate: "التاريخ",
    colType: "النوع",
    colRef: "المرجع",
    colNote: "ملاحظة",
    colAmount: "المبلغ",
    colStatus: "الحالة",
    kindInvoice: "فاتورة / دين",
    kindPayment: "دفعة",
    kindReturn: "إرجاع",
    statusValid: "مؤكد",
    statusUnpaid: "غير مدفوع",
    statusSettled: "مسدد",
    noEntries: "لا توجد حركات مسجلة",
    footer: (clientName, balance) =>
      `كشف حساب — ${clientName}. وثيقة داخلية. الرصيد المتبقي: ${balance}.`,
  },
  procurement: {
    defaultTitle: "إذن قائمة المشتريات",
    listStatusActive: "قيد التنفيذ",
    listStatusCompleted: "مغلقة",
    publishedAt: (date) => `نُشرت في ${date}`,
    totalPartial: "— (أسعار ناقصة)",
    colIndex: "م",
    colDesignation: "الصنف",
    colCategory: "الفئة",
    colQty: "الكمية",
    colUnitCost: "س. شراء",
    colUnitSell: "س. بيع",
    colLineTotal: "مجموع الشراء",
    colStatus: "الحالة",
    summary: (lines, qty, purchase, sell) =>
      `الأصناف: ${lines}  •  الكمية: ${qty}  •  إجمالي الشراء: ${purchase}  •  إجمالي البيع: ${sell}`,
    pending: "للشراء",
    bought: "تم الشراء",
  },
  stock: {
    filter: (label) => `التصنيف: ${label}`,
    search: (query) => `بحث: ${query}`,
    searchEmpty: "بحث: —",
    references: (n) => `المراجع: ${n}`,
    lowStock: (n) => `تنبيهات المخزون: ${n}`,
    sellValuation: (v) => `تقييم البيع: ${v}`,
    costValuation: (v) => `تكلفة المخزون: ${v}`,
    colProduct: "المنتج",
    colCategory: "الفئة",
    colBarcode: "الباركود",
    colCost: "سعر الشراء",
    colSell: "سعر البيع",
    colMargin: "الهامش",
    colStock: "المخزون",
  },
};

export function getDocumentLabels(locale: DocumentLocale): DocumentLabels {
  const base = locale === "ar" ? AR : FR;
  return {
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    lang: locale,
    dateLocale: locale === "ar" ? "ar-MA" : "fr-FR",
    ...base,
  };
}

export function formatDocumentDate(
  date: string,
  _locale: DocumentLocale,
): string {
  return formatDateFr(date);
}

export function formatDocumentDateForPdf(
  date: string,
  _locale: DocumentLocale,
): string {
  return formatDateFr(date);
}

export function formatDocumentDateTimeForPdf(
  _locale: DocumentLocale,
): string {
  return formatNowDateTimeFr();
}

export function formatDocumentDateTime(
  _locale: DocumentLocale,
): string {
  return formatNowDateTimeFr();
}

export type DocumentSettingsInput = {
  businessName?: string;
  storePhone?: string;
  storeAddress?: string;
  taxIce?: string;
  taxIf?: string;
  taxRc?: string;
  documentLocale?: DocumentLocale;
  defaultLocale?: DocumentLocale;
};

export function resolveDocumentLocale(
  settings: DocumentSettingsInput,
): DocumentLocale {
  return settings.documentLocale ?? settings.defaultLocale ?? "fr";
}

export function documentLegalLines(
  settings: DocumentSettingsInput,
  labels: DocumentLabels,
): string[] {
  return [
    settings.storeAddress || null,
    settings.storePhone
      ? `${labels.phonePrefix} ${settings.storePhone}`
      : null,
    settings.taxIce ? `${labels.icePrefix} ${settings.taxIce}` : null,
    settings.taxIf ? `${labels.ifPrefix} ${settings.taxIf}` : null,
    settings.taxRc ? `${labels.rcPrefix} ${settings.taxRc}` : null,
  ].filter((line): line is string => line !== null);
}