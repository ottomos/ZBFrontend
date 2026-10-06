'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { TopNavigation } from './TopNavigation';
import { salesItemForPath } from '../lib/salesNav';

// Persistent navigation layer. Rendered once in the root layout so it stays
// mounted while the page content below it changes on client-side navigation.
// All per-page differences are derived from the current pathname, so the nav
// never unmounts/remounts and therefore never blinks between pages.
export function AppTopNavigation() {
  const pathname = usePathname() || '/';

  // Routes that must NOT show the top navigation.
  const hiddenPrefixes = ['/login'];
  if (hiddenPrefixes.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const activePage = (() => {
    // Sales screens report their own label so the Sales tab/dropdown can
    // highlight the entry that is currently open.
    const salesItem = salesItemForPath(pathname);
    if (salesItem) return salesItem.name;
    if (pathname === '/' || pathname.startsWith('/table')) return 'Trade';
    if (pathname.startsWith('/transactions')) return 'Transaction List';
    if (pathname.startsWith('/overview')) return 'Overview';
    if (pathname.startsWith('/analytics') || pathname.startsWith('/reports')) return 'Analytics';
    if (pathname.startsWith('/user-list')) return 'User List';
    if (pathname.startsWith('/account')) return 'Account';
    return 'Trade';
  })();

  const isAnalytics = activePage === 'Analytics';
  const isManagerView = pathname.startsWith('/sales/manager-view');

  return (
    <TopNavigation
      activePage={activePage}
      // Weekly metrics box is hidden on Analytics and Manager View pages.
      showWeeklyMetrics={!isAnalytics && !isManagerView}
      // ALL-entity aggregation is only available on Analytics.
      allowAllEntitySelection={isAnalytics}
    />
  );
}
