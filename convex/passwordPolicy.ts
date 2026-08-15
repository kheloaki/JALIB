export function assertPasswordRequirements(password: string): void {
  if (!password) {
    throw new Error("Password is required.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (getPasswordStrength(password) === "weak") {
    throw new Error("Password is too weak.");
  }
}

function getPasswordStrength(
  password: string,
): "empty" | "weak" | "medium" | "strong" {
  if (!password) return "empty";

  const characterTypes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  const lengthScore = password.length >= 12 ? 2 : password.length >= 8 ? 1 : 0;
  const score = lengthScore + characterTypes;

  if (password.length < 8 || characterTypes < 2 || score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}
