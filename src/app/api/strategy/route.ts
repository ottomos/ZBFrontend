import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

export async function GET(request: Request) {
  try {
    console.log('🔍 Strategy proxy - API_URL:', API_URL);

    if (!API_URL) {
      console.error('❌ NEXT_PUBLIC_API_URL is not set');
      return NextResponse.json(
        { error: 'API_URL not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profile = searchParams.get('profile') || 'KFH';
    const fullUrl = `${API_URL}/strategy?profile=${profile}`;
    
    console.log('📡 Proxy fetching from:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('✅ Response status:', response.status);

    if (!response.ok) {
      console.error('❌ Response not ok:', response.status);
      const text = await response.text();
      console.error('Response body:', text);
      return NextResponse.json(
        { error: `API returned ${response.status}`, details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Data received, returning to client');
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error in strategy proxy:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch strategy data', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST proxy: forward strategy edits / control messages to backend /kafka
export async function POST(request: Request) {
  try {
    if (!API_URL) {
      console.error('❌ NEXT_PUBLIC_API_URL is not set');
      return NextResponse.json({ error: 'API_URL not configured' }, { status: 500 });
    }

    // Read body once and forward to backend
    const body = await request.json();
    const backendUrl = `${API_URL}/kafka`;
    console.log('📡 Proxying POST /api/strategy ->', backendUrl);

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
    console.error('❌ Error proxying POST /api/strategy:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to proxy POST', details: message }, { status: 500 });
  }
}
