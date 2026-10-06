// In-memory rate limiter: 5 attempts per minute per IP/email
const resetAttempts: { [key: string]: { count: number, last: number } } = {};
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 1000; // 1 minute
import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mail";

// Helper to generate a secure password
function generatePassword(length = 12) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = upper + lower + digits + specials;
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += specials[Math.floor(Math.random() * specials.length)];
  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

export async function POST(request: NextRequest) {
  // DB API base URL - read at runtime to avoid build-time baking issues
  const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;
  
  // Parse body once
  let body;
  try {
    body = await request.json();
  } catch {
    body = { email: '' };
  }
  const { email } = body;
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  // Rate limit logic
  const key = `${ipAddress}:${email}`;
  const now = Date.now();
  if (!resetAttempts[key] || now - resetAttempts[key].last > WINDOW_MS) {
    resetAttempts[key] = { count: 1, last: now };
  } else {
    resetAttempts[key].count++;
    resetAttempts[key].last = now;
  }
  if (resetAttempts[key].count > RATE_LIMIT) {
    return NextResponse.json(
      { success: false, error: `Too many password reset attempts. Please try again in 1 minute.` },
      { status: 429 }
    );
  }
  try {

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }
    // Find user by email via DB API (send role for permissions)
    const usersResponse = await fetch(`${DB_API_URL}/users?role=CoE`);
    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users from DB API');
    }
    const usersData = await usersResponse.json();
    const user = usersData.data.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // Don't reveal whether the email is registered. Always return a generic message.
      return NextResponse.json({ success: true, message: 'New password sent if registered user' }, { status: 200 });
    }
    
    // Generate new password
    const newPassword = generatePassword();
    // Log the new password to the terminal (for admin/dev visibility)
    console.log(`[RESET PASSWORD V2] User: ${user.email} | New Password: ${newPassword}`);
    
    // Update password via DB API (DB API will handle hashing).
    // Flag the account so the user is forced to pick their own password on next login.
    const updateResponse = await fetch(`${DB_API_URL}/users/${user.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword, mustChangePassword: true })
    });

    if (!updateResponse.ok) {
      throw new Error('Failed to update password');
    }

    // Log password reset request
    await fetch(`${DB_API_URL}/audit-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        recordId: user.id,
        ipAddress,
        userAgent
      })
    }).catch(err => console.error('Failed to log audit:', err));

    // Send email with new password (best-effort). Errors are logged but user-facing message remains generic.
    await sendMail({
      to: email,
      subject: "Password Reset",
      text: `Dear ${user.name || 'User'},\n\nYour password has been successfully reset. Please find your new password below:\n\nNew password: ${newPassword}\n\nFor your security, please change this password after your next login.\nIf you did not request this change or need assistance, contact our support team.\n\nBest regards,\nKFH Center of Excellence\n`
    }).catch(err => console.error('Failed to send reset email:', err));

    return NextResponse.json({ success: true, message: 'New password sent if registered user' });
  } catch (error) {
    console.error("Reset password error:", error);
    // For privacy, do not reveal underlying errors to the caller. Return the same generic message.
    return NextResponse.json({ success: true, message: 'New password sent if registered user' }, { status: 200 });
  }
}
