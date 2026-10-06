import { NextRequest, NextResponse } from "next/server";

const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;

export async function GET(request: NextRequest) {
  if (!DB_API_URL) {
    return NextResponse.json(
      { success: false, error: "DB API URL is not configured" },
      { status: 500 }
    );
  }

  // Build target URL carefully to avoid stripping a base '/api' path
  const base = DB_API_URL.replace(/\/$/, "");
  const target = `${base}/reports/apm-hedge-performance${request.nextUrl.search}`;

  try {
    console.log("[proxy] GET /api/reports/apm-hedge-performance ->", target);
    console.log("[proxy] incoming query:", request.nextUrl.search);
    const response = await fetch(target, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("[proxy] db-api status:", response.status);

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      console.log("[proxy] db-api json keys:", payload ? Object.keys(payload) : null);
      return NextResponse.json(payload ?? { success: false }, { status: response.status });
    }

    const text = await response.text().catch(() => "");
    console.log("[proxy] db-api non-json response length:", text.length);
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": contentType },
    });
  } catch (error) {
    console.error("Failed to proxy APM hedge performance", error);
    return NextResponse.json({ success: false, error: "Failed to reach DB API" }, { status: 500 });
  }
}
