import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profile = searchParams.get('profile') || 'KFH';
    
    const response = await fetch(`${API_URL}/risk-monitor?profile=${profile}`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching risk-monitor data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch risk-monitor data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!API_URL) {
      console.error('❌ NEXT_PUBLIC_API_URL is not set');
      return NextResponse.json({ error: 'API_URL not configured' }, { status: 500 });
    }

    const body = await request.json();
    const backendUrl = `${API_URL}/kafka`;
    console.log('📡 Proxying POST /api/risk-monitor ->', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // leave as text
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ Error proxying POST /api/risk-monitor:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to proxy POST', details: message }, { status: 500 });
  }
}
