import type { AlertItem, QuickContactClient } from "@/lib/alerts/types";

/** Stitch export — Alertes & Notifications screen imagery */
export const ALERTS_ADMIN_AVATAR_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA2DCkDMNlmUm2lFuuykTkc2smQOGFaSKU4RCkqdhjm1XwxgX4y1j0UkoeRjJlE6xrgLKfFEVXIFiCUKz9_aBG3omLOodmCiqH2amKd3LOOqGY2flURGmDuckHd6jQg3MV_MsI9UQbzliUN4EkOwlc9lsuCnm4HoZUYR0YLCfpRBPXpxU7opY4Ex3-HBqrBP7-lZBd-_3a6j4i3QNT06Vgn5bfqtQWkmhQQ026ybmRCmCMjOCs3fJ3uEtSdLMQPlp0tM7G5lYnG1b7i";

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: "a1",
    category: "credit_over",
    variant: "whatsapp_ignore",
    badge: "Urgent • Crédit Limite",
    timeLabel: "Il y a 14 min",
    title: "Ahmed Filali a dépassé sa limite de crédit",
    detail: "Actuel: 5,000 DH / Limite: 4,000 DH",
    clientName: "Ahmed Filali",
    whatsappPhone: "212612345678",
  },
  {
    id: "a2",
    category: "credit_warn",
    variant: "details",
    badge: "Attention • 90% Limite",
    timeLabel: "Il y a 2 heures",
    title: "Fatima Zahra à 90% de sa limite de crédit",
    detail:
      "Montant en cours: 3,600 DH (Alerte réglée à 3,500 DH)",
    clientName: "Fatima Zahra",
    whatsappPhone: "212698765432",
  },
  {
    id: "a3",
    category: "unpaid",
    variant: "phone_mail",
    badge: "Échéance • Paiement en retard",
    timeLabel: "Hier à 18:30",
    title: "Échéance: Frigo LG - Paiement en retard (300 DH)",
    detail:
      "Client: Yassine Amrani • Produit: Electroménager",
    clientName: "Yassine Amrani",
    whatsappPhone: "212661112233",
  },
  {
    id: "a4",
    category: "stock",
    variant: "order",
    badge: "Stock • Réapprovisionnement",
    timeLabel: "Aujourd'hui, 09:12",
    title: "Rupture imminente: Huile d'olive (5L)",
    detail: "Stock restant: 3 unités • Seuil d'alerte: 5 unités",
  },
];

export const QUICK_CONTACT_CLIENTS: QuickContactClient[] = [
  {
    id: "c1",
    name: "Ahmed Filali",
    nameAr: "أحمد فيلالي",
    phoneDigits: "212612345678",
    displayPhone: "+212 612-345-678",
    limitDh: 4000,
  },
  {
    id: "c2",
    name: "Fatima Zahra",
    nameAr: "فاطمة الزهراء",
    phoneDigits: "212698765432",
    displayPhone: "+212 698-765-432",
    limitDh: 4000,
  },
  {
    id: "c3",
    name: "Yassine Amrani",
    nameAr: "ياسين عمراني",
    phoneDigits: "212661112233",
    displayPhone: "+212 661-112-233",
    limitDh: 5000,
  },
];

export const ALERT_STATS = { critical: 12, pending: 5 };
