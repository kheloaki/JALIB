export const FIRST_ADMIN_EMAIL = "khalilakirar@gmail.com";

export function isFirstAdminEmail(email: string) {
  return email.trim().toLowerCase() === FIRST_ADMIN_EMAIL;
}
