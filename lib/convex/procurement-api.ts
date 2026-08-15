import type { FunctionReference } from "convex/server";

import { api } from "@/convex/_generated/api";

/**
 * Typed procurement API refs. Use when the IDE's inferred `api` type lags behind
 * `npx convex codegen` (e.g. missing `procurement` until Convex is regenerated).
 */
export const procurementApi = (
  api as unknown as {
    procurement: {
      getActiveList: FunctionReference<"query", "public">;
      getDraftList: FunctionReference<"query", "public">;
      listBons: FunctionReference<"query", "public">;
      getListById: FunctionReference<"query", "public">;
      addItem: FunctionReference<"mutation", "public">;
      removeItem: FunctionReference<"mutation", "public">;
      updateItemQuantity: FunctionReference<"mutation", "public">;
      updateItemPlannedCost: FunctionReference<"mutation", "public">;
      publishList: FunctionReference<"mutation", "public">;
      fulfillItem: FunctionReference<"mutation", "public">;
      completeList: FunctionReference<"mutation", "public">;
    };
  }
).procurement;
