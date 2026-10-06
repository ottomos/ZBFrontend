import { NextRequest, NextResponse } from "next/server";

// Reads come from the DB API (the sls.sel_DealerExecutions_<entity> procedure),
// writes go to the Kafka API (PanelDealerExecutions_<entity>) - which mirrors
// the real flow: the GUI publishes the deal, a consumer persists it, the GUI
// reads it back through the procedure.
const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;
const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

export async function GET(request: NextRequest) {
  if (!DB_API_URL) {
    return NextResponse.json({ success: false, error: "DB API URL is not configured" }, { status: 500 });
  }

  const base = DB_API_URL.replace(/\/$/, "");
  const target = `${base}/sales/dealer-executions${request.nextUrl.search}`;

  try {
    console.log("[proxy] GET /api/sales/dealer-executions ->", target);
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
    console.error("Failed to proxy dealer-executions", error);
    return NextResponse.json({ success: false, error: "Failed to reach DB API" }, { status: 500 });
  }
}

// POST proxy: publish a dealer execution to Kafka via the backend /kafka endpoint.
export async function POST(request: NextRequest) {
  if (!API_URL) {
    return NextResponse.json({ success: false, error: "API_URL not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const target = `${API_URL}/kafka`;
    console.log("[proxy] POST /api/sales/dealer-executions ->", target, body?.topic);

    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { success: false }, { status: response.status });
  } catch (error) {
    console.error("Failed to publish dealer execution", error);
    return NextResponse.json({ success: false, error: "Failed to reach Kafka API" }, { status: 500 });
  }
}
