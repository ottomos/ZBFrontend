import { NextRequest, NextResponse } from "next/server";

const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(request: NextRequest) {
  if (!DB_API_URL) {
    return NextResponse.json(
      { success: false, error: "DB API URL is not configured" },
      { status: 500 }
    );
  }

  const base = DB_API_URL.replace(/\/$/, "");
  const target = `${base}/overview/position-pnl${request.nextUrl.search}`;
  const { searchParams } = request.nextUrl;
  const profile = searchParams.get('profile') || 'KFH';

  try {
    console.log("[proxy] GET /api/overview/position-pnl ->", target);

    // Fire both the DB API call and the live-positions call in parallel so
    // neither blocks the other. Fall back gracefully if positions service
    // is unavailable.
    const posUrl = API_URL
      ? `${API_URL.replace(/\/$/, '')}/positions?profile=${encodeURIComponent(profile)}`
      : null;

    const [response, posRespRaw] = await Promise.all([
      fetch(target, { headers: { "Content-Type": "application/json" } }),
      posUrl ? fetch(posUrl).catch(() => null) : Promise.resolve(null),
    ]);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "");
      return new NextResponse(text, { status: response.status, headers: { "content-type": contentType } });
    }

    const payload = await response.json().catch(() => null);
    const dbData = Array.isArray(payload?.data) ? payload.data : [];

    // If upstream API for positions is not configured, just return DB payload as-is
    if (!API_URL) {
      return NextResponse.json(payload ?? { success: false }, { status: response.status });
    }

    // merge the already-fetched positions response (no additional await needed)
    try {
      const posResp = posRespRaw;
      if (!posResp) {
        return NextResponse.json(payload ?? { success: false }, { status: response.status });
      }
      const posPayload = await posResp.json().catch(() => null);
      const positions: any[] = Array.isArray(posPayload?.data) ? posPayload.data : [];

      // normalization helpers (keep in sync with client)
      function symbolVariants(raw?: any) {
        const s = String(raw ?? '').toUpperCase().trim();
        if (!s) return [];
        const noSpaces = s.replace(/\s+/g, '');
        const alnumSlash = noSpaces.replace(/[^A-Z0-9/]/g, '');
        const noSlash = alnumSlash.replace(/\//g, '');
        const stripLeadingX = alnumSlash.startsWith('X') ? alnumSlash.slice(1) : alnumSlash;
        const stripLeadingXNoSlash = stripLeadingX.replace(/\//g, '');
        return Array.from(new Set([alnumSlash, noSlash, stripLeadingX, stripLeadingXNoSlash]));
      }

      const posMap: Record<string, any> = {};
      positions.forEach(p => {
        const raw = p.Symbol ?? p.SymbolName ?? p.CurrencyPair ?? p.Currency ?? '';
        const variants = symbolVariants(raw);
        variants.forEach(v => { if (v) posMap[v] = p; });
      });

      const merged = dbData.map((r: any) => {
        const symbol = String(r.Symbol ?? r.CurrencyPair ?? r.Pair ?? '').toUpperCase();
        const tryKeys = symbolVariants(symbol).concat([symbol]);
        let pos: any = {};
        for (const k of tryKeys) {
          if (k && posMap[k]) { pos = posMap[k]; break; }
        }

        const exposure = pos.Position ?? pos.Exposure ?? r.Exposure ?? 0;
        const usdEq = pos['Position Value'] ?? pos.PositionValue ?? pos['PositionValue'] ?? r['USD Equivalent'] ?? r.USD_Equivalent ?? r['USD Equivalent'] ?? 0;
        const avgCost = pos['Avg Cost Rate'] ?? pos.AvgCostRate ?? r['Avg Cost Rate'] ?? r.AvgCostRate ?? 0;
        const unrealized = pos['Unrealized PNL'] ?? pos.UnrealizedPnL ?? r['Unrealized PnL'] ?? r.UnrealizedPnL ?? 0;

        return {
          ...r,
          Symbol: symbol,
          Exposure: exposure,
          USD_Equivalent: usdEq,
          AvgCostRate: avgCost,
          UnrealizedPnL: unrealized,
        };
      });

      return NextResponse.json({ success: true, data: merged }, { status: response.status });
    } catch (e) {
      console.warn('Failed to fetch/merge positions, returning DB payload', e);
      return NextResponse.json(payload ?? { success: false }, { status: response.status });
    }
  } catch (error) {
    console.error("Failed to proxy position-pnl", error);
    return NextResponse.json({ success: false, error: "Failed to reach DB API" }, { status: 500 });
  }
}
