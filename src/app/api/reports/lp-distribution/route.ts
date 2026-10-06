import { NextRequest, NextResponse } from "next/server";

const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;

export async function GET(request: NextRequest) {
  if (!DB_API_URL) {
    return NextResponse.json({ success: false, error: "DB API URL is not configured" }, { status: 500 });
  }

  const base = DB_API_URL.replace(/\/$/, "");
  const target = `${base}/reports/lp-distribution${request.nextUrl.search}`;

  try {
    console.log("[proxy] GET /api/reports/lp-distribution ->", target);
    const response = await fetch(target, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("[proxy] db-api status:", response.status);

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      return NextResponse.json(payload ?? { success: false }, { status: response.status });
    }

    const text = await response.text().catch(() => "");
    return new NextResponse(text, { status: response.status, headers: { "content-type": contentType } });
  } catch (error) {
    console.error("Failed to proxy lp-distribution", error);
    return NextResponse.json({ success: false, error: "Failed to reach DB API" }, { status: 500 });
  }
}
