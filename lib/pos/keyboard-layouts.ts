export type PosKeyboardLayout = "alpha" | "arabic" | "numeric";

export const ALPHA_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Backspace"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", ":"],
  ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "Clear"],
];

/** Arabic letters — standard Moroccan / Arabic 101 style (RTL). */
export const ARABIC_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Backspace"],
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ة"],
  ["ئ", "ء", "ؤ", "ر", "ى", "و", "ز", "ظ", "،", ".", "Clear"],
];

export const NUMERIC_ROWS: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["+", "0", "Backspace"],
];

export function keyboardRowsForLayout(layout: PosKeyboardLayout): string[][] {
  if (layout === "numeric") return NUMERIC_ROWS;
  if (layout === "arabic") return ARABIC_ROWS;
  return ALPHA_ROWS;
}

export function defaultLetterLayout(locale: string): "alpha" | "arabic" {
  return locale === "ar" ? "arabic" : "alpha";
}
