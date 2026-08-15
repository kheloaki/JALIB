/** Wait until images under a print root are decoded (or timeout). */
export async function waitForPrintImages(
  root: ParentNode | null | undefined,
  timeoutMs = 600,
): Promise<void> {
  if (!root || typeof document === "undefined") return;

  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return;

  const pending = images.filter(
    (img) => !(img.complete && img.naturalWidth > 0),
  );
  if (pending.length === 0) return;

  await Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            if (typeof img.decode === "function") {
              void img.decode().then(done).catch(done);
            }
          }),
      ),
    ),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}

/** Prefetch thermal logo so checkout print does not wait on first decode. */
export function prefetchPrintLogo(src: string): void {
  if (typeof document === "undefined") return;
  const existing = document.querySelector(
    `link[data-prefetch-print-logo="${src}"]`,
  );
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = src;
  link.setAttribute("data-prefetch-print-logo", src);
  document.head.appendChild(link);
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

function resolvePrintMode(
  root: HTMLElement | null,
): "client" | "owner" | "document" {
  const mode = root?.getAttribute("data-copy-mode");
  if (mode === "client" || mode === "owner") return mode;
  return "document";
}

function applyPrintPageStyle(mode: "client" | "owner" | "document") {
  document
    .querySelectorAll("style[data-print-page-style]")
    .forEach((node) => node.remove());

  const style = document.createElement("style");
  style.setAttribute("data-print-page-style", mode);
  if (mode === "client") {
    // Thermal ticket — 80mm roll, minimal margins for ESC/POS-style drivers
    style.textContent = `
      @page {
        size: 80mm auto;
        margin: 2mm;
      }
    `;
  } else {
    // Internal invoice / statements — full A4
    style.textContent = `
      @page {
        size: A4 portrait;
        margin: 12mm;
      }
    `;
  }
  document.head.appendChild(style);
  document.documentElement.setAttribute("data-print-page", mode);
}

function clearPrintPageStyle() {
  document
    .querySelectorAll("style[data-print-page-style]")
    .forEach((node) => node.remove());
  document.documentElement.removeAttribute("data-print-page");
}

export async function printElementById(
  id: string,
  timeoutMs = 600,
): Promise<void> {
  const root = document.getElementById(id);
  const mode = resolvePrintMode(root);
  applyPrintPageStyle(mode);
  await waitForPrintImages(root, timeoutMs);

  const cleanup = () => {
    clearPrintPageStyle();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();

  // Fallback if afterprint never fires (some mobile WebViews)
  window.setTimeout(cleanup, 60_000);
}
