'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

const ENTITY_STORAGE_KEY = 'selectedEntity';
const LAST_NON_ALL_ENTITY_STORAGE_KEY = 'lastNonAllEntity';
const USER_STORAGE_KEY = 'user';

const normalizeEntity = (entity?: string | null, allowAll = false): string => {
  const normalized = String(entity || '').trim().toUpperCase();
  if (!normalized) return 'KFH';
  if (normalized === 'ALL') return allowAll ? 'ALL' : 'KFH';
  return normalized;
};

const hasWindow = () => globalThis.window !== undefined;

const getStoredUserLockedEntity = (): string | null => {
  if (!hasWindow()) return null;

  try {
    const rawUser = globalThis.localStorage.getItem(USER_STORAGE_KEY);
    if (!rawUser) return null;

    const user = JSON.parse(rawUser) as { entity?: string; role?: string };
    const normalizedEntity = String(user?.entity || '').trim().toUpperCase();
    const normalizedRole = String(user?.role || '').trim().toUpperCase();
    const isCoE = normalizedEntity === 'ALL';
    const isGroupHeadTrader = normalizedRole === 'GROUP HEAD TRADER';

    if (!isCoE && !isGroupHeadTrader && normalizedEntity) {
      return normalizedEntity;
    }
  } catch {}

  return null;
};

const getStoredLastNonAllEntity = (): string | null => {
  if (!hasWindow()) return null;
  const normalized = normalizeEntity(globalThis.localStorage.getItem(LAST_NON_ALL_ENTITY_STORAGE_KEY));
  return normalized || null;
};

const getInitialEntity = (pathname?: string | null): string => {
  if (!hasWindow()) return 'KFH';

  const lockedEntity = getStoredUserLockedEntity();
  if (lockedEntity) return lockedEntity;

  const allowAll = String(pathname ?? globalThis.location.pathname).startsWith('/analytics');
  const stored = globalThis.localStorage.getItem(ENTITY_STORAGE_KEY);
  // Leaving /analytics must fall back to the last real entity, not to the
  // hardcoded default, otherwise a CoE user silently jumps to KFH.
  if (!allowAll && String(stored || '').trim().toUpperCase() === 'ALL') {
    return getStoredLastNonAllEntity() || 'KFH';
  }
  return normalizeEntity(stored, allowAll);
};

interface EntityContextValue {
  selectedEntity: string;
  setSelectedEntity: (entity: string) => void;
}

const EntityContext = createContext<EntityContextValue | null>(null);

export function EntityProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  // Initialize synchronously and prefer the logged-in user's locked entity
  // so pages don't briefly fetch with a stale persisted selection.
  const initial = getInitialEntity();
  const [selectedEntity, setSelectedEntityState] = useState<string>(initial);

  // Re-derived on every navigation, not just on mount: this provider lives in
  // the root layout, so it is already mounted (with no user in localStorage,
  // i.e. 'KFH') while the login screen is showing. Logging in is a client-side
  // route change, which never remounts the layout - so a mount-only effect left
  // a KT dealer's session pinned to KFH topics until a hard refresh.
  useEffect(() => {
    const nextEntity = getInitialEntity(pathname);
    setSelectedEntityState((prev) => prev === nextEntity ? prev : nextEntity);
    if (hasWindow()) {
      globalThis.localStorage.setItem(ENTITY_STORAGE_KEY, nextEntity);
      if (nextEntity !== 'ALL') {
        globalThis.localStorage.setItem(LAST_NON_ALL_ENTITY_STORAGE_KEY, nextEntity);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (!hasWindow()) return;
    if (selectedEntity !== 'ALL') return;
    if (pathname?.startsWith('/analytics')) return;

    const fallback = getStoredLastNonAllEntity() || getStoredUserLockedEntity() || 'KFH';
    setSelectedEntityState(fallback);
    globalThis.localStorage.setItem(ENTITY_STORAGE_KEY, fallback);
    globalThis.localStorage.setItem(LAST_NON_ALL_ENTITY_STORAGE_KEY, fallback);
  }, [pathname, selectedEntity]);

  const setSelectedEntity = (entity: string) => {
    const normalizedEntity = normalizeEntity(entity, true);
    setSelectedEntityState(normalizedEntity);
    if (hasWindow()) {
      globalThis.localStorage.setItem(ENTITY_STORAGE_KEY, normalizedEntity);
      if (normalizedEntity !== 'ALL') {
        globalThis.localStorage.setItem(LAST_NON_ALL_ENTITY_STORAGE_KEY, normalizedEntity);
      }
    }
  };

  const value = useMemo(() => ({ selectedEntity, setSelectedEntity }), [selectedEntity]);

  return (
    <EntityContext.Provider value={value}>
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error('useEntity must be used within an EntityProvider');
  }
  return context;
}
