import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

// POST proxy: forward manual trade messages to backend /kafka
export async function POST(request: Request) {
  try {
    if (!API_URL) {
      console.error('❌ NEXT_PUBLIC_API_URL is not set');
      return NextResponse.json({ error: 'API_URL not configured' }, { status: 500 });
    }

    const body = await request.json();
    const backendUrl = `${API_URL}/kafka`;
    console.log('📡 Proxying POST /api/manual-trade ->', backendUrl);

    const resp = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch (_) { /* not JSON */ }

    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error('❌ Error proxying POST /api/manual-trade:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to proxy POST', details: message }, { status: 500 });
  }
}
