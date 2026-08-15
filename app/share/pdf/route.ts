import { NextResponse } from "next/server";

function convexSiteUrl(): string | null {
  const explicit = process.env.CONVEX_SITE_URL?.replace(/\/$/, "").trim();
  if (explicit) return explicit;

  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/$/, "").trim();
  if (!cloud) return null;
  // https://xxx.convex.cloud → https://xxx.convex.site
  if (cloud.includes(".convex.cloud")) {
    return cloud.replace(".convex.cloud", ".convex.site");
  }
  return null;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const site = convexSiteUrl();
  if (!site) {
    return NextResponse.json(
      { error: "Share backend is not configured." },
      { status: 500 },
    );
  }

  const upstream = await fetch(
    `${site}/share/pdf?token=${encodeURIComponent(token)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/pdf",
      },
    },
  );

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new NextResponse(text || "Link not found or expired", {
      status: upstream.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("Content-Type") ?? "application/pdf",
  );
  const disposition = upstream.headers.get("Content-Disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
