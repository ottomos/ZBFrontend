import { NextRequest, NextResponse } from "next/server";

// DB API base URL - our new database API
const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("session")?.value;

    if (sessionToken) {
      try {
        // Find session by token and delete it via DB API
        const sessionsResponse = await fetch(`${DB_API_URL}/sessions`);
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          const session = sessionsData.data.find((s: any) => s.token === sessionToken);
          
          if (session) {
            // Delete the session using our DB API
            const deleteResponse = await fetch(`${DB_API_URL}/sessions/${session.id}`, {
              method: 'DELETE'
            });
            
            if (deleteResponse.ok) {
              console.log("Session deleted successfully via DB API");
            }
          }
        }
      } catch (error) {
        // Session might not exist in DB, but that's ok for logout
        console.log("Session not found during logout:", error);
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("session");
    
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
