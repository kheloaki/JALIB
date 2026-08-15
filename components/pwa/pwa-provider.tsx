"use client";

import { useEffect } from "react";

import { registerServiceWorker } from "@/lib/pwa/register-service-worker";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return children;
}
