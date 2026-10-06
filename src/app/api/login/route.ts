// In-memory rate limiter: 5 attempts per minute per IP/email
const loginAttempts: { [key: string]: { count: number, last: number } } = {};
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 1000; // 1 minute
console.log('Using DB API instead of direct Prisma access');
import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/lib/auth";

// DB API base URL - our new database API
const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;

export async function POST(request: NextRequest) {
  // Parse body once
  let body;
  try {
    body = await request.json();
  } catch {
    body = { email: '', password: '' };
  }
  const { email, password } = body;

  // Rate limit logic
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const key = `${ip}:${email}`;
  const now = Date.now();
  if (!loginAttempts[key] || now - loginAttempts[key].last > WINDOW_MS) {
    loginAttempts[key] = { count: 1, last: now };
  } else {
    loginAttempts[key].count++;
    loginAttempts[key].last = now;
  }
  if (loginAttempts[key].count > RATE_LIMIT) {
    return NextResponse.json(
      { success: false, error: `Too many login attempts. Please try again in 1 minute.` },
      { status: 429 }
    );
  }
  try {
    
    console.log('=== LOGIN REQUEST ===');
    console.log('DB_API_URL:', DB_API_URL);
    console.log('Email:', email);

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email OR username using our DB API
    // Use CoE as a default role for login fetch (since no user is authenticated yet)
    // Send role as query parameter for compatibility
    const usersUrl = `${DB_API_URL}/users?role=CoE`;
    console.log('Fetching from:', usersUrl);
    const usersResponse = await fetch(usersUrl);
    console.log('Response status:', usersResponse.status);
    if (!usersResponse.ok) {
      const errorText = await usersResponse.text();
      console.error('Failed to fetch users from DB API:', errorText);
      throw new Error('Failed to fetch users from DB API');
    }
    
    const usersData = await usersResponse.json();
    console.log('Total users from DB API:', usersData.data.length);
    console.log('Looking for email/username:', email);
    
    const user = usersData.data.find((u: any) => 
      u.email.toLowerCase() === email.toLowerCase() || u.username === email
    );
    
    console.log('Login attempt via DB API:', email, user ? 'User found: ' + user.username : 'User not found');
    console.log('Available users:', usersData.data.map((u: any) => ({ username: u.username, email: u.email })));

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Incorrect Username/Password" },
        { status: 401 }
      );
    }

    // Block login for inactive users
    if (user.status !== 'Active') {
      return NextResponse.json(
        { success: false, error: "User is blocked or inactive" },
        { status: 403 }
      );
    }

    // Check password - authenticate via DB API
    const userDetailResponse = await fetch(`${DB_API_URL}/users/${user.id}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (!userDetailResponse.ok) {
      console.error('DB API auth failed:', await userDetailResponse.text());
      return NextResponse.json(
        { success: false, error: "Incorrect Username/Password" },
        { status: 401 }
      );
    }

    const authResult = await userDetailResponse.json();
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: "Incorrect Username/Password" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Whether this account still uses a system-issued (temporary) password.
    const needsChange = user.mustChangePassword === true || user.mustChangePassword === 1;

    // Create session using our DB API
    const sessionResponse = await fetch(`${DB_API_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        userId: user.id,
        // Kuwait local time (UTC+03:00) so session timestamps read as T+3.
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 23)
      })
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to create session via DB API');
    }

    const response = NextResponse.json({
      success: true,
      mustChangePassword: needsChange,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
        surname: user.surname,
        entity: user.entity,
        permissions: user.permissions,
        mustChangePassword: needsChange
      }
    });

    // Only establish the session cookie once the password is no longer temporary.
    if (!needsChange) {
      response.cookies.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60, // 24 hours
        path: "/"
      });
    }

    return response;
  } catch (error) {
    console.error("Login error (DB API):", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
