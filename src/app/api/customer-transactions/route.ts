import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profile = searchParams.get('profile') || 'KFH';

  // Fetch from backend API
  const res = await fetch(`${API_URL}/customer-transactions?profile=${profile}`);
  const data = await res.json();

  return NextResponse.json(data);
}
