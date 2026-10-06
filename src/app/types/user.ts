export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  permissions: string[];
  gsm?: string;
  name?: string;
  surname?: string;
  password?: string;
  entity?: string;
}

// Helper function to check if user can perform trading actions
export function canUserTrade(user: User | null, entity?: string): boolean {
  if (!user) return false;
  const normalizedRole = String(user.role || '').trim().toUpperCase();
  const normalizedUserEntity = String(user.entity || '').trim().toUpperCase();
  const normalizedSelectedEntity = String(entity || '').trim().toUpperCase();

  if (normalizedRole === 'GROUP HEAD TRADER') {
    // Allow trading in KFH regardless of user's entity
    return normalizedSelectedEntity === 'KFH';
  }
  if (normalizedRole === 'ENTITY ADMIN' || normalizedRole === 'ENTITY TRADER') {
    // Only allow trading in their own entity
    return normalizedUserEntity !== '' && normalizedUserEntity === normalizedSelectedEntity;
  }
  return false;
}

// Helper function to check if user can access user management
export function canUserManageUsers(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'CoE' || user.role === 'Entity Admin' || user.role === 'Management' || user.role === 'Group Head Trader';
}

// Dealer is a Sales-only role: it replaces the standard navigation with the
// Sales screens and has no trading, entity-selection or user-management rights.
export function isDealer(user: { role?: string } | null | undefined): boolean {
  return String(user?.role || '').trim().toUpperCase() === 'DEALER';
}
