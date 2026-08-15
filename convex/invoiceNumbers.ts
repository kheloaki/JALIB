import type { MutationCtx } from "./_generated/server";

export async function nextInvoiceSequence(ctx: MutationCtx) {
  const current = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "invoiceCounter"))
    .unique();
  const currentValue =
    current && typeof current.value === "number" && Number.isFinite(current.value)
      ? Math.floor(current.value)
      : 1000;
  const next = currentValue + 1;
  if (current) {
    await ctx.db.patch(current._id, { value: next, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("settings", {
      key: "invoiceCounter",
      value: next,
      updatedAt: Date.now(),
    });
  }
  return next;
}
