import { NextRequest, NextResponse } from "next/server";

// DB API base URL - our new database API
const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "No session found" }, { status: 401 });
    }
    
    // Find session via DB API
    const sessionsResponse = await fetch(`${DB_API_URL}/sessions`);
    if (!sessionsResponse.ok) {
      throw new Error('Failed to fetch sessions from DB API');
    }
    
    const sessionsData = await sessionsResponse.json();
    const session = sessionsData.data.find((s: any) => s.token === sessionToken);
    
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 401 });
    }
    
    // Check session expiration. Sessions are stored in Kuwait local time (T+3),
    // so compare against the same shifted clock.
    if (new Date(session.expiresAt) < new Date(Date.now() + 3 * 60 * 60 * 1000)) {
      // Delete expired session via DB API
      await fetch(`${DB_API_URL}/sessions/${session.id}`, { method: 'DELETE' });
      return NextResponse.json({ success: false, error: "Session expired" }, { status: 401 });
    }
    
    // Get user info via DB API
    const userResponse = await fetch(`${DB_API_URL}/users/${session.userId}`);
    if (!userResponse.ok) {
      throw new Error('Failed to fetch user from DB API');
    }
    
    const userData = await userResponse.json();
    if (!userData.success) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
    }
    
    // Return user info (password already excluded by DB API)
    return NextResponse.json({ success: true, user: userData.data });
  } catch (error) {
    console.error('Get current user error (DB API):', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
