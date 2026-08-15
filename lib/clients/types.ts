export type Client = {
  id: string;
  fullName: string;
  phone: string;
  /** True => client comptant uniquement (pas de vente à crédit). */
  isCashOnly: boolean;
  /**
   * Plafond de crédit en MAD (encours max autorisé).
   * `null` = pas de limite (crédit autorisé sans plafond).
   */
  creditLimitMad: number | null;
  /**
   * Solde initial (MAD). Same sign as UI solde:
   * positive = avoir, negative = dette, 0 = none.
   */
  initialSoldeMad: number;
};
