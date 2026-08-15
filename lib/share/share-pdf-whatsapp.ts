import type { jsPDF } from "jspdf";

import { whatsappHref } from "@/lib/alerts/whatsapp";

export function jsPdfOutputBlob(doc: jsPDF): Blob {
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type UploadPdfShareLink = (
  blob: Blob,
  filename: string,
) => Promise<string>;

export type SharePdfViaWhatsAppOptions = {
  blob: Blob;
  filename: string;
  message: string;
  phoneDigits?: string | null;
  uploadShareLink: UploadPdfShareLink;
  /**
   * Prefer attaching the PDF via the system share sheet (WhatsApp on phone).
   * Falls back to the WhatsApp link method when file sharing is unavailable.
   * Default: true.
   */
  preferFileShare?: boolean;
  /** Force the existing URL link method (skips file share). */
  forceLink?: boolean;
};

export type SharePdfViaWhatsAppResult =
  | { mode: "file" }
  | { mode: "link"; url: string };

function openWhatsAppChat(message: string, phoneDigits?: string | null) {
  const digits = phoneDigits?.replace(/\D/g, "") ?? "";
  const url = digits
    ? whatsappHref(digits, message)
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function toPdfFile(blob: Blob, filename: string): File {
  const safeName = filename.trim() || "document.pdf";
  return new File([blob], safeName, {
    type: blob.type || "application/pdf",
    lastModified: Date.now(),
  });
}

/** True when this browser/OS can share a PDF file (e.g. to WhatsApp). */
export function canSharePdfFile(blob: Blob, filename: string): boolean {
  if (typeof navigator === "undefined" || typeof File === "undefined") {
    return false;
  }
  if (typeof navigator.canShare !== "function") return false;
  try {
    const file = toPdfFile(blob, filename);
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function sharePdfAsFile(
  blob: Blob,
  filename: string,
  message: string,
): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }

  const file = toPdfFile(blob, filename);
  const payload: ShareData = {
    files: [file],
    title: filename,
    text: message,
  };

  if (
    typeof navigator.canShare === "function" &&
    !navigator.canShare({ files: [file] })
  ) {
    return false;
  }

  await navigator.share(payload);
  return true;
}

async function sharePdfAsWhatsAppLink(
  blob: Blob,
  filename: string,
  message: string,
  phoneDigits: string | null | undefined,
  uploadShareLink: UploadPdfShareLink,
): Promise<{ mode: "link"; url: string }> {
  const pdfUrl = await uploadShareLink(blob, filename);
  const fullMessage = `${message}\n\n📄 ${pdfUrl}`;
  openWhatsAppChat(fullMessage, phoneDigits);
  return { mode: "link", url: pdfUrl };
}

/**
 * Share a PDF toward WhatsApp.
 * 1) Try native file share (PDF attachment) when the OS/browser supports it.
 * 2) Fall back to WhatsApp chat + download URL (existing method).
 */
export async function sharePdfViaWhatsApp({
  blob,
  filename,
  message,
  phoneDigits,
  uploadShareLink,
  preferFileShare = true,
  forceLink = false,
}: SharePdfViaWhatsAppOptions): Promise<SharePdfViaWhatsAppResult> {
  if (!forceLink && preferFileShare) {
    try {
      const shared = await sharePdfAsFile(blob, filename, message);
      if (shared) return { mode: "file" };
    } catch (error) {
      // User closed the share sheet — do not fall back to opening WhatsApp.
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      // File share failed for another reason → keep URL method.
    }
  }

  return sharePdfAsWhatsAppLink(
    blob,
    filename,
    message,
    phoneDigits,
    uploadShareLink,
  );
}

export function whatsAppShareToastCopy(
  result: SharePdfViaWhatsAppResult,
  locale: string,
): { title: string; description: string } {
  const isAr = locale === "ar";

  if (result.mode === "file") {
    return isAr
      ? {
          title: "تم مشاركة الملف",
          description:
            "اختر واتساب من قائمة المشاركة لإرسال ملف PDF مباشرة.",
        }
      : {
          title: "Fichier partagé",
          description:
            "Choisissez WhatsApp dans le menu pour envoyer le PDF en pièce jointe.",
        };
  }

  return isAr
    ? {
        title: "رابط PDF جاهز",
        description:
          "فُتح واتساب مع رابط التحميل. الزبون يضغط على الرابط لتحميل الملف.",
      }
    : {
        title: "Lien PDF prêt",
        description:
          "WhatsApp s'ouvre avec le lien du PDF. Le client clique pour télécharger le fichier.",
      };
}
