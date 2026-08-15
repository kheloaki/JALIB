import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireAnyPermission } from "./authz";

export const listManual = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      "alerts.view",
      "credits.collect",
      "stock.view",
      "reports.revenue",
    ]);
    return await ctx.db.query("alerts").order("desc").take(100);
  },
});
