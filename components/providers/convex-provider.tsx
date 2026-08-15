"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

type ConvexClientProviderProps = {
  children: React.ReactNode;
};

export function ConvexClientProvider({
  children,
}: ConvexClientProviderProps) {
  if (!convexClient) return children;

  return (
    <ConvexAuthProvider client={convexClient}>
      {children}
    </ConvexAuthProvider>
  );
}
