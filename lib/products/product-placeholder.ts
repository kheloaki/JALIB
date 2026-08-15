/** Neutral catalogue image used until a product photo is uploaded. */
export const PRODUCT_PLACEHOLDER_IMAGE = "/product-placeholder.svg";

export function resolveProductImage(image?: string | null): string {
  const trimmed = image?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : PRODUCT_PLACEHOLDER_IMAGE;
}

export function isProductPlaceholderImage(image?: string | null): boolean {
  const trimmed = image?.trim() ?? "";
  if (!trimmed) return true;
  return (
    trimmed === PRODUCT_PLACEHOLDER_IMAGE ||
    trimmed.endsWith("/product-placeholder.svg")
  );
}
