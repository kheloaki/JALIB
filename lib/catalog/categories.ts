export const CATALOG_CATEGORIES = [
  "Livres scolaires",
  "Lecture",
  "Cahiers & papier",
  "Écriture",
  "Sacs & trousses",
  "Géométrie & calculatrices",
  "Arts plastiques",
  "Informatique",
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const DEFAULT_CATALOG_CATEGORY = CATALOG_CATEGORIES[0];
