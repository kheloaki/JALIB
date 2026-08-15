import type { Product } from "@/components/pos/types";
import { normalizeSearchQuery } from "@/lib/admin/filter-utils";

const TOKEN_SPLIT = /[^a-z0-9\u0600-\u06ff]+/;

function tokenizeNormalized(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(TOKEN_SPLIT).filter(Boolean);
}

/** True when the typed query is mostly a barcode / number (not a product name). */
function isBarcodeLikeQuery(query: string, qDigits: string): boolean {
  if (qDigits.length < 3) return false;
  const letters = query.replace(/[^\p{L}]/gu, "");
  return letters.length === 0;
}

function isAllDigits(value: string): boolean {
  if (!value) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

/** All digit runs in text ("ab12cd100غ" → ["12", "100"]). */
function digitRuns(text: string): string[] {
  const runs: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      current += text[i]!;
    } else if (current) {
      runs.push(current);
      current = "";
    }
  }
  if (current) runs.push(current);
  return runs;
}

/**
 * Token matches a field when:
 * - text: field starts with token OR contains token
 * - digits: any number in the field starts with those digits (1→1/10/100, 10→10/100, not 20)
 */
function fieldMatchesToken(field: string, token: string): boolean {
  if (!token || !field) return false;
  if (field === token || field.startsWith(token) || field.includes(token)) {
    return true;
  }
  if (isAllDigits(token)) {
    return digitRuns(field).some((run) => run.startsWith(token));
  }
  return false;
}

function fieldMatchesTokenExact(field: string, token: string): boolean {
  if (!isAllDigits(token)) {
    return field === token || field.startsWith(token);
  }
  return digitRuns(field).some((run) => run === token);
}

function poolMatchesAllTokens(pool: string[], tokens: string[]): boolean {
  return tokens.every((token) =>
    pool.some((field) => fieldMatchesToken(field, token)),
  );
}

function poolMatchesAllTokensExact(pool: string[], tokens: string[]): boolean {
  return tokens.every((token) =>
    pool.some((field) => fieldMatchesTokenExact(field, token)),
  );
}

/**
 * Extra digits beyond the typed number (0 = exact "10", 1 = "100").
 * Keeps closer sizes first.
 */
function digitPrefixExtra(pool: string[], tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    if (!isAllDigits(token)) continue;
    let best = Number.POSITIVE_INFINITY;
    for (const field of pool) {
      for (const run of digitRuns(field)) {
        if (run.startsWith(token)) {
          best = Math.min(best, run.length - token.length);
        }
      }
    }
    if (best < Number.POSITIVE_INFINITY) total += best;
  }
  return total;
}

function tokensAppearInOrder(name: string, tokens: string[]): boolean {
  let cursor = 0;
  for (const token of tokens) {
    const idx = name.indexOf(token, cursor);
    if (idx < 0) return false;
    cursor = idx + token.length;
  }
  return true;
}

type PreparedQuery = {
  raw: string;
  q: string;
  tokens: string[];
  qDigits: string;
  barcodeLike: boolean;
};

function prepareQuery(query: string): PreparedQuery {
  const q = normalizeSearchQuery(query);
  const tokens = tokenizeNormalized(q);
  const qDigits = query.replace(/\D/g, "");
  return {
    raw: query,
    q,
    tokens,
    qDigits,
    barcodeLike: isBarcodeLikeQuery(query, qDigits),
  };
}

type RankedHit = { rank: number; extraDigits: number };

/**
 * Lower rank = closer to what the user typed.
 * `null` = no match.
 *
 * Every token must match somewhere (name / brand / barcode) by start or contain.
 * Numbers use digit-prefix (1→1/10/100, 10→10/100, not 20).
 */
export function getProductSearchRank(
  product: Product,
  query: string,
): number | null {
  return rankProduct(product, prepareQuery(query))?.rank ?? null;
}

function rankProduct(
  product: Product,
  prepared: PreparedQuery,
): RankedHit | null {
  const { q, tokens, qDigits, barcodeLike } = prepared;
  if (!q) return { rank: 0, extraDigits: 0 };

  const name = normalizeSearchQuery(product.name);
  const brand = product.brandName
    ? normalizeSearchQuery(product.brandName)
    : "";
  const barcodeRaw = product.barcode?.trim() ?? "";
  const barcode = barcodeRaw ? normalizeSearchQuery(barcodeRaw) : "";
  const barcodeDigits = barcodeRaw.replace(/\D/g, "");
  const nameWords = tokenizeNormalized(name);
  const brandWords = brand ? tokenizeNormalized(brand) : [];
  const pool = [name, ...nameWords, ...(brand ? [brand, ...brandWords] : [])];

  // Barcode-only queries (pure digits)
  if (barcodeLike && barcodeDigits) {
    if (barcodeDigits === qDigits) return { rank: 0, extraDigits: 0 };
    if (barcodeDigits.startsWith(qDigits)) return { rank: 1, extraDigits: 0 };
    if (barcodeDigits.includes(qDigits)) return { rank: 2, extraDigits: 0 };
  }

  if (name === q || barcode === q) return { rank: 3, extraDigits: 0 };
  if (name.startsWith(q) || (barcode && barcode.startsWith(q))) {
    return { rank: 4, extraDigits: 0 };
  }
  // Full typed phrase contained in the name (start/contain for the whole query).
  if (name.includes(q)) return { rank: 5, extraDigits: 0 };

  if (tokens.length > 1) {
    if (!poolMatchesAllTokens(pool, tokens)) {
      // Last chance: barcode may carry a numeric token.
      if (barcode) {
        const withBarcode = [...pool, barcode, barcodeDigits];
        if (!poolMatchesAllTokens(withBarcode, tokens)) return null;
        const extraDigits = digitPrefixExtra(withBarcode, tokens);
        return { rank: 9, extraDigits };
      }
      return null;
    }

    const extraDigits = digitPrefixExtra(pool, tokens);
    const exactNums = poolMatchesAllTokensExact(pool, tokens);
    const inOrder = tokensAppearInOrder(name, tokens);

    if (exactNums && inOrder) return { rank: 6, extraDigits };
    if (exactNums) return { rank: 7, extraDigits };
    if (inOrder) return { rank: 8, extraDigits };
    return { rank: 9, extraDigits };
  }

  const token = tokens[0] ?? q;
  const extraDigits = digitPrefixExtra(pool, tokens);

  if (nameWords.some((word) => word === token)) {
    return { rank: 6, extraDigits };
  }
  if (pool.some((field) => fieldMatchesTokenExact(field, token))) {
    return { rank: 7, extraDigits };
  }
  if (pool.some((field) => fieldMatchesToken(field, token))) {
    return { rank: 8, extraDigits };
  }
  if (
    barcode &&
    (barcode === token ||
      barcode.startsWith(token) ||
      barcode.includes(token) ||
      (isAllDigits(token) &&
        digitRuns(barcodeDigits).some((run) => run.startsWith(token))))
  ) {
    return { rank: 9, extraDigits: 0 };
  }

  return null;
}

export function productMatchesSearch(
  product: Product,
  query: string,
): boolean {
  const prepared = prepareQuery(query);
  if (rankProduct(product, prepared) != null) return true;

  // Stock / admin: also allow category hits (POS ranking skips these).
  if (!prepared.q) return true;
  const category = normalizeSearchQuery(product.category);
  if (prepared.tokens.length > 1) {
    return prepared.tokens.every((token) => fieldMatchesToken(category, token));
  }
  return fieldMatchesToken(category, prepared.q);
}

/** Filter products and put the closest typed matches first. */
export function filterAndRankProductsBySearch<T extends Product>(
  products: readonly T[],
  query: string,
  compareTieBreak?: (a: T, b: T) => number,
): T[] {
  const prepared = prepareQuery(query);
  if (!prepared.q) return [...products];

  const scored: { product: T; rank: number; extraDigits: number }[] = [];
  for (const product of products) {
    const hit = rankProduct(product, prepared);
    if (hit == null) continue;
    scored.push({ product, rank: hit.rank, extraDigits: hit.extraDigits });
  }
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.extraDigits !== b.extraDigits) return a.extraDigits - b.extraDigits;
    if (compareTieBreak) return compareTieBreak(a.product, b.product);
    return a.product.name.localeCompare(b.product.name, "fr");
  });
  return scored.map((row) => row.product);
}
