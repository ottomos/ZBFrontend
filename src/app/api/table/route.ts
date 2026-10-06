import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profile = searchParams.get('profile') || 'KFH';
    
    const response = await fetch(`${API_URL}/table?profile=${profile}`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table data' },
      { status: 500 }
    );
  }
}
