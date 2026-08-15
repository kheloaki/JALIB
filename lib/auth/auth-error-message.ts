/** Strip Convex / client noise from thrown auth errors. */
function collectRawErrorText(err: unknown): string {
  if (typeof err === "string") return err;

  if (err instanceof Error) {
    const chunks = [err.message];
    if ("data" in err && err.data !== undefined) {
      const data = (err as Error & { data: unknown }).data;
      if (typeof data === "string") chunks.push(data);
      else if (data && typeof data === "object" && "message" in data) {
        chunks.push(String((data as { message: unknown }).message));
      }
    }
    return chunks.filter(Boolean).join("\n");
  }

  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const chunks: string[] = [];
    if (typeof record.message === "string") chunks.push(record.message);
    if (record.data !== undefined) {
      if (typeof record.data === "string") chunks.push(record.data);
      else if (record.data && typeof record.data === "object") {
        const data = record.data as Record<string, unknown>;
        if (typeof data.message === "string") chunks.push(data.message);
      }
    }
    return chunks.filter(Boolean).join("\n");
  }

  return "";
}

/** Pull the human message out of Convex action error blobs. */
export function extractAuthErrorCoreMessage(raw: string): string {
  if (!raw) return "";

  const uncaught = raw.match(/Uncaught Error:\s*([^\n]+)/i);
  if (uncaught?.[1]) return uncaught[1].trim();

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("at ")) continue;
    if (trimmed.includes("[CONVEX")) continue;
    if (/^server error$/i.test(trimmed)) continue;

    const withoutPrefix = trimmed.replace(/^Error:\s*/i, "").trim();
    if (withoutPrefix) return withoutPrefix;
  }

  return raw
    .replace(/\[CONVEX[^\]]*\]/gi, "")
    .replace(/\[Request ID:[^\]]+\]/gi, "")
    .replace(/Server Error/gi, "")
    .replace(/Called by client/gi, "")
    .replace(/\s+at\s+[\s\S]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripConvexNoise(raw: string): string {
  return raw
    .replace(/\[CONVEX[^\]]*\]/gi, "")
    .replace(/\[Request ID:[^\]]+\]/gi, "")
    .replace(/Called by client/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeStackTrace(text: string): boolean {
  return (
    text.includes(" at validate") ||
    text.includes(" at authorize") ||
    text.includes(" at handleCredentials") ||
    text.includes("node_modules/") ||
    text.includes("../../convex/")
  );
}

export type AuthErrorCopy = {
  invalidCredentials: string;
  emailInvalid: string;
  passwordRequired: string;
  passwordTooShort: string;
  passwordTooWeak: string;
  accountExists: string;
  accountNotFound: string;
  networkError: string;
  serverError: string;
  generic: string;
};

/**
 * Maps Convex Auth / Password provider errors to short, user-facing copy.
 */
export function getAuthErrorMessage(
  err: unknown,
  copy: AuthErrorCopy,
  mode: "signIn" | "signUp",
): string {
  const raw = collectRawErrorText(err);
  const core = extractAuthErrorCoreMessage(raw);
  const text = `${core} ${stripConvexNoise(raw)}`.toLowerCase();

  if (!text.trim()) return copy.generic;

  if (
    text.includes("missing `password`") ||
    text.includes("missing password") ||
    text.includes("password is required") ||
    text.includes("password required")
  ) {
    return copy.passwordRequired;
  }

  if (
    text.includes("at least 8") ||
    text.includes("too short") ||
    text.includes("8 characters")
  ) {
    return copy.passwordTooShort;
  }

  if (
    text.includes("too weak") ||
    text.includes("weak password") ||
    text.includes("uppercase") ||
    text.includes("symbol") ||
    text.includes("number")
  ) {
    return copy.passwordTooWeak;
  }

  if (
    text.includes("invalidsecret") ||
    text.includes("invalid secret") ||
    text.includes("incorrect password") ||
    text.includes("wrong password") ||
    (text.includes("invalid") && text.includes("password"))
  ) {
    return copy.invalidCredentials;
  }

  if (
    text.includes("invalidaccount") ||
    text.includes("account not found") ||
    text.includes("no account") ||
    text.includes("user not found")
  ) {
    return mode === "signIn" ? copy.invalidCredentials : copy.accountNotFound;
  }

  if (
    text.includes("already exists") ||
    text.includes("already registered") ||
    text.includes("duplicate")
  ) {
    return copy.accountExists;
  }

  if (text.includes("valid email") || text.includes("email is required")) {
    return copy.emailInvalid;
  }

  if (
    text.includes("fetch failed") ||
    text.includes("network") ||
    text.includes("failed to fetch") ||
    text.includes("load failed")
  ) {
    return copy.networkError;
  }

  const isGenericServerError =
    text.includes("server error") &&
    !core.toLowerCase().includes("password") &&
    !core.toLowerCase().includes("email");

  if (
    isGenericServerError ||
    text.includes("internal server error") ||
    text.includes("unexpected error")
  ) {
    return copy.serverError;
  }

  if (core && !looksLikeStackTrace(core) && core.length < 160) {
    return core;
  }

  return mode === "signIn" ? copy.invalidCredentials : copy.generic;
}
