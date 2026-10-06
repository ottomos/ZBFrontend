import { NextRequest, NextResponse } from "next/server";

// DB API base URL - our new database API
const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("session")?.value;
    if (sessionToken) {
      // Find session via DB API
      const sessionsResponse = await fetch(`${DB_API_URL}/sessions`);
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        const session = sessionsData.data.find((s: any) => s.token === sessionToken);
        if (session) {
          await fetch(`${DB_API_URL}/sessions/${session.id}`, { method: 'DELETE' });
        }
      }
    }
    // Clear the session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/"
    });
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
