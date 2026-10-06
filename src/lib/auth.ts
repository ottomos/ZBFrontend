import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// JWT utilities
export function generateToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
  } catch {
    return null;
  }
}

// Note: User management functions have been moved to DB API
// The following functions are no longer used as we've migrated to API-based database access
// All user operations now go through the DB API on port 5000

// Role checking utilities
export function canAccessUserManagement(role: string): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'CoE' || role === 'Entity Admin' || role === 'Management' || role === 'Group Head Trader';
}

export function canCreateAdminUsers(role: string): boolean {
  return role === 'super_admin' || role === 'CoE';
}
