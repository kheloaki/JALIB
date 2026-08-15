export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export function getPasswordStrength(password: string): PasswordStrength {
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

export function isPasswordAcceptableForSignUp(password: string): boolean {
  const strength = getPasswordStrength(password);
  return strength === "medium" || strength === "strong";
}
