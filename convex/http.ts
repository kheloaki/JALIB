import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/share/pdf",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const token = new URL(req.url).searchParams.get("token")?.trim();
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    const link = await ctx.runQuery(internal.sharePdfs.getLinkByToken, {
      token,
    });
    if (!link) {
      return new Response("Link not found or expired", { status: 404 });
    }

    const blob = await ctx.storage.get(link.storageId);
    if (!blob) {
      return new Response("File not found", { status: 404 });
    }

    const safeFilename = link.filename.replace(/[^\w.\-() ]+/g, "_");
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }),
});

export default http;
