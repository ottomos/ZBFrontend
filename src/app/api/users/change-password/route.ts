import { NextRequest, NextResponse } from "next/server";

// DB API base URL - our database API
const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;

// POST /api/users/change-password
// Body: { email, currentPassword, newPassword }
// Looks up the user by email/username, then asks the DB API to verify the
// current (temporary) password, set the new one, and clear mustChangePassword.
export async function POST(request: NextRequest) {
  let body: { email?: string; currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const { email, currentPassword, newPassword } = body;

  if (!email || !currentPassword || !newPassword) {
    return NextResponse.json(
      { success: false, error: "Email, current password and new password are required" },
      { status: 400 }
    );
  }

  try {
    // Find the user by email or username (no auth yet, same as login).
    const usersResponse = await fetch(`${DB_API_URL}/users?role=CoE`);
    if (!usersResponse.ok) {
      throw new Error("Failed to fetch users from DB API");
    }
    const usersData = await usersResponse.json();
    const user = Array.isArray(usersData.data)
      ? usersData.data.find(
          (u: any) =>
            String(u.email || "").toLowerCase() === email.toLowerCase() ||
            u.username === email
        )
      : null;

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Incorrect Username/Password" },
        { status: 401 }
      );
    }

    const changeResponse = await fetch(`${DB_API_URL}/users/${user.id}/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const changeData = await changeResponse.json().catch(() => ({ success: false, error: "Invalid response" }));
    return NextResponse.json(changeData, { status: changeResponse.status });
  } catch (error) {
    console.error("Change-password error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
