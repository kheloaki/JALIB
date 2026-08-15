/** Pure client-name ranking shared by Convex searchSummaries (no @/ imports). */

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function tokenize(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function isAllDigits(value: string): boolean {
  if (!value) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

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

/** Lower = better. `null` = reject. */
export function getClientSearchRank(
  client: { fullName: string; phone: string },
  query: string,
): number | null {
  const q = fold(query);
  if (!q) return 0;

  const name = fold(client.fullName);
  const phone = fold(client.phone);
  const phoneDigits = client.phone.replace(/\D/g, "");
  const qDigits = query.replace(/\D/g, "");
  const nameWords = name.split(/\s+/).filter(Boolean);

  if (qDigits.length >= 1 && phoneDigits) {
    if (phoneDigits === qDigits) return 0;
    if (phoneDigits.startsWith(qDigits)) return 1;
    if (qDigits.length >= 3 && phoneDigits.includes(qDigits)) return 2;
    if (digitRuns(phoneDigits).some((run) => run.startsWith(qDigits))) {
      return 2;
    }
  }

  if (name === q) return 3;
  if (name.startsWith(q)) return 4;
  if (name.includes(q)) return 5;

  const tokens = tokenize(query);

  if (tokens.length > 1) {
    if (!tokens.every((token) => fieldMatchesToken(name, token))) return null;

    let cursor = 0;
    let inOrder = true;
    for (const token of tokens) {
      const idx = name.indexOf(token, cursor);
      if (idx < 0) {
        inOrder = false;
        break;
      }
      cursor = idx + token.length;
    }

    const allWordPrefix = tokens.every((token) =>
      nameWords.some(
        (word) => word.startsWith(token) || word.includes(token),
      ),
    );

    if (allWordPrefix && inOrder) return 6;
    if (allWordPrefix) return 7;
    if (inOrder) return 8;
    return 9;
  }

  const token = tokens[0] ?? q;
  if (nameWords.some((word) => word.startsWith(token))) return 6;
  if (fieldMatchesToken(name, token)) return 7;
  if (fieldMatchesToken(phone, token) || fieldMatchesToken(phoneDigits, token)) {
    return 8;
  }
  return null;
}

export function rankClientSearchResults<T extends { fullName: string; phone: string }>(
  clients: readonly T[],
  query: string,
  limit: number,
): T[] {
  const scored: { client: T; rank: number }[] = [];
  for (const client of clients) {
    const rank = getClientSearchRank(client, query);
    if (rank == null) continue;
    scored.push({ client, rank });
  }
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.client.fullName.localeCompare(b.client.fullName, "ar");
  });
  return scored.slice(0, Math.max(0, limit)).map((row) => row.client);
}
