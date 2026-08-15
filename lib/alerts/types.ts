export type AlertCategory =
  | "credit_over"
  | "credit_warn"
  | "unpaid"
  | "installment_missed"
  | "stock";

export type AlertCardVariant =
  | "whatsapp_ignore"
  | "details"
  | "phone_mail"
  | "order";

export type AlertItem = {
  id: string;
  category: AlertCategory;
  variant: AlertCardVariant;
  badge: string;
  timeLabel: string;
  title: string;
  detail: string;
  clientName?: string;
  /** Digits only, country code without + (e.g. 212612345678) */
  whatsappPhone?: string;
};

export type AlertTabFilter = "all" | "credit" | "unpaid" | "stock";

export type QuickContactClient = {
  id: string;
  name: string;
  phoneDigits: string;
  displayPhone: string;
  limitDh: number;
  /** Arabic given name for RTL template line */
  nameAr?: string;
};
