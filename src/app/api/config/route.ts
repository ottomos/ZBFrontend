import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    API_URL: process.env.NEXT_PUBLIC_API_URL?.trim(),
    DB_API_URL: process.env.NEXT_PUBLIC_DB_API_URL?.trim(),
  });
}
