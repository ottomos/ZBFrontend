import { NextResponse } from 'next/server';

// This route proxies to the internal DB API endpoint that executes the stored procedure.
// Use `NEXT_PUBLIC_DB_API_URL` from the environment (no fallback).
const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL?.trim();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const profile = (url.searchParams.get('profile') || 'KFH').toUpperCase();

  if (!DB_API_URL) {
    console.error('❌ NEXT_PUBLIC_DB_API_URL is not set');
    return NextResponse.json({ success: false, error: 'db_api_not_configured' }, { status: 500 });
  }

  try {
    // Normalize configured DB API base. If the env includes a trailing '/api',
    // strip it so the proxy calls the msdb root `/db-sales-pnl` endpoint.
    // This keeps environment values untouched while ensuring correct routing.
    let base = DB_API_URL.replace(/\/$/, '');
    if (/\/api$/i.test(base)) {
      base = base.replace(/\/api$/i, '');
    }
    const target = `${base}/db-sales-pnl${url.search}`;

    console.log('[proxy] GET /api/sales-pnl -> proxying to:', target);
    const r = await fetch(target, { cache: 'no-store' });

    const contentType = r.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      let payload = null;
      try {
        payload = await r.json();
      } catch (parseErr) {
        const text = await r.text().catch(() => '');
        console.error('[proxy] Failed to parse JSON from msdb-api, forwarding text. parseErr:', parseErr);
        return new NextResponse(text, { status: r.status, headers: { 'content-type': contentType } });
      }
      return NextResponse.json(payload ?? { success: false }, { status: r.status });
    }

    const text = await r.text().catch(() => '');
    console.log('[proxy] msdb-api non-json response, length:', text.length);
    return new NextResponse(text, { status: r.status, headers: { 'content-type': contentType } });
  } catch (err) {
    console.error('Error proxying to msdb-api /db-sales-pnl:', err);
    return NextResponse.json({ success: false, error: 'msdb_proxy_error', details: String(err) }, { status: 502 });
  }
}
