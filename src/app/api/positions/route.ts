import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profile = searchParams.get('profile') || 'KFH';
    
    const response = await fetch(`${API_URL}/positions?profile=${profile}`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching positions data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions data' },
      { status: 500 }
    );
  }
}

// POST proxy: forward position-related write messages (e.g. close position)
export async function POST(request: Request) {
  try {
    if (!API_URL) {
      console.error('❌ NEXT_PUBLIC_API_URL is not set');
      return NextResponse.json({ error: 'API_URL not configured' }, { status: 500 });
    }

    const bodyText = await request.text();
    let outgoingBody = bodyText;
    let contentType = request.headers.get('content-type') || 'application/json';

    if (!bodyText) {
      outgoingBody = '';
      contentType = 'text/plain';
    } else {
      try {
        const parsed = JSON.parse(bodyText);
        outgoingBody = JSON.stringify(parsed);
        contentType = 'application/json';
      } catch (e) {
        const incomingCT = request.headers.get('content-type');
        if (incomingCT) contentType = incomingCT;
        else if (/^\s*[\{\[]/.test(bodyText)) contentType = 'application/json';
        else contentType = 'text/plain';
      }
    }

    const target = `${API_URL}/kafka`;
    console.log('📡 Proxying POST /api/positions ->', target);

    const headers: Record<string, string> = { 'content-type': contentType };
    const auth = request.headers.get('authorization');
    if (auth) headers.authorization = auth;

    const resp = await fetch(target, { method: 'POST', headers, body: outgoingBody });
    const respText = await resp.text();
    const respCT = resp.headers.get('content-type') || 'text/plain';
    return new NextResponse(respText, { status: resp.status, headers: { 'content-type': respCT } });
  } catch (err) {
    console.error('❌ Error proxying POST /api/positions:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to proxy POST', details: message }, { status: 500 });
  }
}
