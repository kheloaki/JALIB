"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function usePdfShareUpload() {
  const generateUploadUrl = useMutation(api.sharePdfs.generateUploadUrl);
  const createShareLink = useMutation(api.sharePdfs.createShareLink);

  return useCallback(
    async (blob: Blob, filename: string) => {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      if (!response.ok) {
        throw new Error("PDF upload failed");
      }
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      const publicOrigin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const { url } = await createShareLink({
        storageId,
        filename,
        ...(publicOrigin ? { publicOrigin } : {}),
      });
      return url;
    },
    [createShareLink, generateUploadUrl],
  );
}
