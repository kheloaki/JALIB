import { Email } from "@convex-dev/auth/providers/Email";

const DEFAULT_FROM = "Jamaa Market <onboarding@resend.dev>";

export const passwordResetEmail = Email({
  id: "password-reset",
  maxAge: 60 * 15,
  from: process.env.AUTH_EMAIL_FROM ?? DEFAULT_FROM,
  sendVerificationRequest: async ({ identifier, token }) => {
    const apiKey = process.env.AUTH_RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Password reset email is not configured. Ask an administrator to reset your password.",
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? DEFAULT_FROM,
        to: [identifier],
        subject: "Jamaa Market — code de réinitialisation",
        text: `Votre code de réinitialisation : ${token}\n\nValable 15 minutes.`,
        html: `<p>Votre code de réinitialisation : <strong style="font-size:1.25rem;letter-spacing:0.15em">${token}</strong></p><p>Valable 15 minutes.</p>`,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to send reset email. Try again later.");
    }
  },
});
