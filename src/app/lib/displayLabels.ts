// Display-only labels. The database keeps the original role/entity values;
// these helpers are used purely for what the user sees in the UI.

const ROLE_LABELS: Record<string, string> = {
  'Group Head Trader': 'Head Trader',
  'Entity Admin': 'Admin',
  'Entity Trader': 'Trader',
  'Entity Viewer': 'Viewer',
};

export function roleLabel(role?: string | null): string {
  const value = String(role || '').trim();
  return ROLE_LABELS[value] || value;
}

export function entityLabel(entity?: string | null): string {
  const value = String(entity || '').trim();
  if (!value || value.toUpperCase() === 'ALL') return 'KFH Group';
  return value;
}
