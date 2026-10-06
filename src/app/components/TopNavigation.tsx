'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { User, canUserManageUsers, isDealer } from '../types/user';
import { useEntity } from '../context/EntityContext';
import { formatNumberWithCommas } from '../lib/numberFormatter';
import { entityLabel, roleLabel } from '../lib/displayLabels';
import { kafkaPollInterval } from '../lib/polling';
import { SALES_NAV_ITEMS } from '../lib/salesNav';

const EMPTY_METRICS_ROWS: Array<{ 'Unrealized PNL': string; 'Realized PNL': string; 'Position Value'?: string }> = [];
const POSITION_POLL_MS = kafkaPollInterval(5_000);

// ---- Top-bar logo size ----
// Tweak these to resize the KFH APEX logo in the header.
// Height is what you normally want to change; width is the box it is fitted into
// (objectFit: 'contain' keeps the aspect ratio, so extra width just adds slack).
const NAV_LOGO_HEIGHT_PX = 60;
const NAV_LOGO_WIDTH_PX = 188;
const NAV_LOGO_RIGHT_GAP_PX = 1;// Nudge the logo without affecting the layout around it.
// Positive X moves right, negative X moves left.
// Positive Y moves down, negative Y moves up.
const NAV_LOGO_OFFSET_X_PX = 0;
// The logo PNG carries ~7% transparent padding along its bottom edge and none on
// top, so the artwork sits high inside its box. This nudge re-centres the visible
// artwork on the nav bar's midline (same baseline as the Trade/Overview tabs).
const NAV_LOGO_OFFSET_Y_PX = 0.25;

// ---- Top-bar tab spacing ----
// Every tab uses the same horizontal padding, so the visual distance between two
// neighbouring labels is always 2 x NAV_ITEM_PADDING_X_PX.
const NAV_ITEM_PADDING_X_PX = 16;
// The Sales tab additionally renders a dropdown chevron after its label. Left as
// is, that chevron (plus its gap) widens the space between "Sales" and the next
// tab. Tuck it inside the existing right padding instead - centred in that slot -
// so "Sales" keeps the same label-to-label distance as the other tabs.
const NAV_SALES_CHEVRON_SIZE_PX = 13;
const NAV_SALES_CHEVRON_SLACK_PX = Math.max(
  0,
  (NAV_ITEM_PADDING_X_PX - NAV_SALES_CHEVRON_SIZE_PX) / 2,
);
// Extra room after the chevron so the Sales dropdown is visibly separated from
// the tab that follows it instead of sitting flush against it.
const NAV_SALES_TRAILING_GAP_PX = 5;

// ---- Top-bar tab responsive scaling ----
// The nav tabs use the largest font/padding that fits the available space. When
// the fixed-size right boxes (weekly metrics / entity / account) leave the left
// island too narrow, the tab text and padding scale down proportionally (down to
// a readable floor) instead of overflowing into those boxes.
const NAV_ITEM_MAX_FONT_PX = 15; // must match .app-topbar .topnav-tab font-size
// The tabs can shrink well below the "readable" floor because the fixed-size
// right boxes (weekly metrics / entity / account) keep the island very narrow at
// zoomed-in viewports. 9px keeps "Transaction List" legible while still fitting.
const NAV_ITEM_MIN_FONT_PX = 9;
const NAV_ITEM_MIN_SCALE = NAV_ITEM_MIN_FONT_PX / NAV_ITEM_MAX_FONT_PX;

// Use layout effect on the client (runs before paint => no flash) but fall
// back to a no-op-ish effect on the server to avoid the SSR warning.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

interface TopNavigationProps {
  currentUser?: User | null;
  onLogout?: () => void;
  activePage?: string;
  showFullDetails?: boolean;
  showWeeklyMetrics?: boolean;
  dataRows?: Array<{ 'Unrealized PNL': string; 'Realized PNL': string; 'Position Value'?: string }>;
  selectedEntity?: string;
  onEntityChange?: (entity: string) => void;
  allowAllEntitySelection?: boolean;
}

// A single tab in the top bar. `isSales` marks the dropdown trigger.
interface NavEntry {
  key: string;
  label: string;
  active: boolean;
  isSales?: boolean;
}

function isTotalSummaryRow(row: Record<string, unknown>) {
  const summaryKeys = ['Symbol', 'symbol', 'CurrencyPair', 'currencyPair', 'Pair', 'pair', 'Currency', 'currency'];
  return summaryKeys.some((key) => {
    const value = row[key];
    return typeof value === 'string' && /^total\b/i.test(value.trim());
  });
}

export function TopNavigation({ 
  currentUser, 
  onLogout, 
  activePage = 'Trade', 
  showFullDetails = true, 
  showWeeklyMetrics = true, 
  dataRows = EMPTY_METRICS_ROWS,
  selectedEntity = 'KFH', 
  onEntityChange,
  allowAllEntitySelection = false,
}: TopNavigationProps) {
  const router = useRouter();
    // Prefer the global EntityContext so selection persists and highlights across pages.
    // The app root wraps with `EntityProvider`, so `useEntity()` is safe to call.
    const ctx = useEntity();
    const effectiveSelected = ctx?.selectedEntity ?? selectedEntity;
    const effectiveOnEntityChange = onEntityChange ?? ctx?.setSelectedEntity;
    // If page didn't supply `currentUser`, fetch it here so the entity
    // selector can render consistently and not blink when pages load.
    // NOTE: initial state must NOT read sessionStorage, otherwise the server
    // (which has no sessionStorage) and the first client render would differ
    // and cause a hydration mismatch. The cache is applied in a layout effect
    // below (runs before paint => no visible flash, no mismatch).
    const [localUser, setLocalUser] = React.useState<User | null | undefined>(currentUser ?? undefined);
    const [canAccessUserList, setCanAccessUserList] = React.useState<boolean | null>(null);

    // Apply cached values synchronously after hydration, before the browser
    // paints, so the user box and User List link appear without a flash.
    useIsomorphicLayoutEffect(() => {
      if (!currentUser) {
        try {
          const raw = globalThis.sessionStorage.getItem('ui.currentUser');
          if (raw) setLocalUser(JSON.parse(raw) as User);
        } catch {}
      }
      try {
        const raw = globalThis.sessionStorage.getItem('ui.canAccessUserList');
        if (raw === '1') setCanAccessUserList(true);
        else if (raw === '0') setCanAccessUserList(false);
      } catch {}
    }, []);

    React.useEffect(() => {
      let mounted = true;
      if (!currentUser) {
        fetch('/api/users/me')
          .then(r => r.json())
          .then(payload => {
            if (!mounted) return;
            if (payload?.success && payload?.user) {
              setLocalUser(payload.user);
              try { globalThis.sessionStorage.setItem('ui.currentUser', JSON.stringify(payload.user)); } catch {}
            } else {
              setLocalUser(null);
              setCanAccessUserList(false);
              try { globalThis.sessionStorage.removeItem('ui.currentUser'); } catch {}
              try { globalThis.sessionStorage.setItem('ui.canAccessUserList', '0'); } catch {}
            }
          })
          .catch(() => { if (mounted) setLocalUser(null); });
      } else {
        setLocalUser(currentUser);
        try { globalThis.sessionStorage.setItem('ui.currentUser', JSON.stringify(currentUser)); } catch {}
      }
      return () => { mounted = false; };
    }, [currentUser]);

    // The account page edits profile fields; refresh the user box immediately.
    React.useEffect(() => {
      const onUserUpdated = (event: Event) => {
        const updated = (event as CustomEvent<User>).detail;
        if (updated) setLocalUser(updated);
      };
      globalThis.addEventListener('ui:user-updated', onUserUpdated);
      return () => globalThis.removeEventListener('ui:user-updated', onUserUpdated);
    }, []);

    const resolvedUser = (currentUser ?? localUser);

    React.useEffect(() => {
      // Only act on a known, truthy user. While the user is still loading the
      // prop is `null` (pages pass `currentUser={null}` before their fetch
      // resolves) - downgrading to false here would hide the User List link and
      // then show it again a moment later (the reported flash). The definitive
      // "no user" case is handled by the fetch effect above.
      if (!resolvedUser) return;
      const canManage = canUserManageUsers(resolvedUser);
      setCanAccessUserList(canManage);
      try {
        globalThis.sessionStorage.setItem('ui.canAccessUserList', canManage ? '1' : '0');
      } catch {}
    }, [resolvedUser]);

    // When the nav is rendered as a persistent layer (no `dataRows` passed by a
    // page), fetch positions here so the Weekly Metrics box stays populated.
    const [internalPositionRows, setInternalPositionRows] = React.useState<Array<Record<string, string>>>([]);
    const hasPageProvidedMetricsRows = dataRows.length > 0;

    React.useEffect(() => {
      if (!showWeeklyMetrics) return;
      if (hasPageProvidedMetricsRows) return; // page supplies its own data
      let mounted = true;
      let controller: AbortController | null = null;
      const run = async () => {
        if (!mounted) return;
        try {
          controller?.abort();
        } catch {}
        controller = new AbortController();
        try {
          const res = await fetch(`/api/positions?profile=${effectiveSelected || 'KFH'}`, { signal: controller.signal });
          if (!mounted) return;
          if (!res.ok) { setInternalPositionRows([]); return; }
          const payload = await res.json();
          if (mounted) setInternalPositionRows(payload?.data || []);
        } catch (err) {
          if ((err as { name?: string })?.name === 'AbortError') return;
          if (mounted) setInternalPositionRows([]);
        }
      };
      run();
      const id = setInterval(run, POSITION_POLL_MS);
      return () => {
        mounted = false;
        clearInterval(id);
        try { controller?.abort(); } catch {}
      };
    }, [showWeeklyMetrics, hasPageProvidedMetricsRows, effectiveSelected]);

    // Rows that feed the Weekly Metrics box: prefer page-provided data, else
    // the nav's own fetched positions.
    const metricsRows = hasPageProvidedMetricsRows ? dataRows : internalPositionRows;

    // Calculate cumulative P&L from DataTable rows
    const cumulativePNL = metricsRows.reduce((acc, row) => {
      const unrealized = parseFloat(row['Unrealized PNL']?.replace(/[^0-9eE+.-]+/g, '') || '0');
      const realized = parseFloat(row['Realized PNL']?.replace(/[^0-9eE+.-]+/g, '') || '0');
      return acc + unrealized + realized;
    }, 0);

    // Calculate cumulative Position from DataTable rows (using 'Position Value')
    const cumulativePosition = metricsRows.reduce((acc, row) => {
      const positionValue = parseFloat(row['Position Value']?.replace(/[^0-9eE+.-]+/g, '') || '0');
      return acc + positionValue;
    }, 0);

    // Derive APM and Sales P&L if present in rows (fall back to 0)
    const apmPNL = metricsRows.reduce((acc, row) => {
      const v = (row as any)['APM PNL'] || (row as any)['APM P&L'] || (row as any)['APM'];
      const n = parseFloat((v || '').toString().replace(/[^0-9eE+.-]+/g, '')) || 0;
      return acc + n;
    }, 0);
    const salesPNLRows = metricsRows.filter((row) => !isTotalSummaryRow(row as Record<string, unknown>));
    const salesPNLSourceRows = salesPNLRows.length > 0 ? salesPNLRows : metricsRows;
    const salesPNL = salesPNLSourceRows.reduce((acc, row) => {
      const v = (row as any)['Sales PnL'] || (row as any)['Sales PNL'] || (row as any)['Sales P&L'] || (row as any)['Sales'];
      const n = parseFloat((v || '').toString().replace(/[^0-9eE+.-]+/g, '')) || 0;
      return acc + n;
    }, 0);

    // Sales P&L read from Kafka API (summed from last Saturday 09:00)
    const [salesPnlApi, setSalesPnlApi] = React.useState<number | null>(null);

    function getLastSaturdayNine() {
      const now = new Date();
      // JS: Sunday=0 .. Saturday=6
      const day = now.getDay();
      // Calculate difference in days to last Saturday
      const daysSinceSaturday = (day >= 6) ? day - 6 : day + 1; // if Saturday (6) -> 0, if Sunday (0) -> 1
      const lastSaturday = new Date(now);
      lastSaturday.setDate(now.getDate() - daysSinceSaturday);
      lastSaturday.setHours(9, 0, 0, 0);
      // If today is Saturday but time is before 09:00, subtract 7 days to get previous Saturday
      const candidate = lastSaturday;
      if (now.getDay() === 6 && now.getHours() < 9) {
        candidate.setDate(candidate.getDate() - 7);
      }
      return candidate;
    }

    async function fetchSalesPnlFromApi(profile: string) {
      try {
        const r = await fetch(`/api/sales-pnl?profile=${profile}`);
        if (!r.ok) {
          setSalesPnlApi(null);
          return;
        }
        const payload = await r.json();
        if (payload && typeof payload.salesPnl === 'number') {
          setSalesPnlApi(payload.salesPnl);
        } else {
          setSalesPnlApi(null);
        }
      } catch (err) {
        console.error('Error fetching Sales PnL from API:', err);
        setSalesPnlApi(null);
      }
    }

    // Poll Sales PnL every 1 second (fixed interval)
    React.useEffect(() => {
      let mounted = true;

      const runOnce = async () => {
        if (!mounted) return;
        try {
          await fetchSalesPnlFromApi(effectiveSelected || 'KFH');
        } catch (e) {
          // swallow errors; fetch function logs details
        }
      };

      // immediate first run
      runOnce();

      const timer = setInterval(runOnce, 30000);
      return () => {
        mounted = false;
        clearInterval(timer);
      };
    }, [effectiveSelected]);

    // If APM P&L isn't provided but cumulativePNL is, prefer that value
    const apmPNLResolved = (apmPNL === 0 && cumulativePNL !== 0) ? cumulativePNL : apmPNL;
    const salesPNLResolved = salesPnlApi !== null ? salesPnlApi : salesPNL;

  // Get color for P&L based on value
  function getPNLColor(value: number) {
    if (value > 0) return 'var(--status-normal-text)';
    if (value < 0) return 'var(--critical)';
    return 'var(--text-primary)';
  }
  const [clock, setClock] = React.useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', { hour12: false });
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-GB', { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sales dropdown: every role except Dealer reaches the Sales screens here.
  const [salesMenuOpen, setSalesMenuOpen] = React.useState(false);
  const salesMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!salesMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (salesMenuRef.current && !salesMenuRef.current.contains(event.target as Node)) {
        setSalesMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSalesMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [salesMenuOpen]);

  // Dealers navigate the Sales screens directly; they never see the standard tabs.
  const dealerUser = isDealer(resolvedUser);
  const isSalesPageActive = SALES_NAV_ITEMS.some((item) => item.name === activePage);

  // Filter navigation items based on user permissions
  const standardNavItems: NavEntry[] = [
    { key: 'Trade', label: 'Trade', active: activePage === 'Trade' },
    { key: 'Transaction List', label: 'Transaction List', active: activePage === 'Transaction List' },
    { key: 'Overview', label: 'Overview', active: activePage === 'Overview' },
    { key: 'Analytics', label: 'Analytics', active: activePage === 'Analytics' },
    { key: 'Sales', label: 'Sales', active: isSalesPageActive, isSales: true },
  ];

  // Only reveal User List once we positively know the user is allowed.
  // Showing it optimistically while the permission is still resolving caused a
  // brief flash for users without credentials (shown then removed).
  const showUserList = canAccessUserList === true && !dealerUser;

  // Measure the island's content width so the tabs can scale down instead of
  // overflowing into the fixed-size boxes on the right. The island has
  // flex-1 min-w-0, so its width shrinks as the right boxes consume space.
  const islandRef = React.useRef<HTMLDivElement | null>(null);
  const tabsRef = React.useRef<HTMLDivElement | null>(null);
  const [islandContentWidth, setIslandContentWidth] = React.useState<number | null>(null);
  const [logoAndGapWidth, setLogoAndGapWidth] = React.useState(0);
  // Natural (full-size) width of the tabs row, measured once at max font size.
  const [naturalTabsWidth, setNaturalTabsWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    const island = islandRef.current;
    if (!island) return;
    const measure = () => {
      const contentWidth = island.clientWidth;
      setIslandContentWidth(contentWidth);
      // The tabs' left offset inside the island already accounts for the island
      // padding, the logo, and the flex gap. Subtracting it from the island's
      // content width gives the exact width the tabs row can occupy.
      const tabs = tabsRef.current;
      if (tabs) {
        const islandRect = island.getBoundingClientRect();
        const tabsRect = tabs.getBoundingClientRect();
        setLogoAndGapWidth(tabsRect.left - islandRect.left);
      } else {
        const logo = island.querySelector('img');
        const logoWidth = logo ? logo.getBoundingClientRect().width : 0;
        setLogoAndGapWidth(logoWidth + NAV_LOGO_RIGHT_GAP_PX);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(island);
    return () => ro.disconnect();
  }, []);

  let navItems: NavEntry[];
  if (dealerUser) {
    navItems = SALES_NAV_ITEMS.map((item) => ({
      key: item.name,
      label: item.name,
      active: activePage === item.name,
    }));
  } else if (showUserList) {
    // Only show User List for CoE and Entity Admin (stable during page transitions)
    navItems = [...standardNavItems, { key: 'User List', label: 'User List', active: activePage === 'User List' }];
  } else {
    navItems = standardNavItems;
  }

  // Capture the tabs' natural (unscaled) width. The first render uses the max
  // font size, so scrollWidth there reflects the full-size layout. Only update
  // the baseline while the tabs are at full size to avoid a feedback loop where
  // shrinking the tabs makes the measured width smaller and shrinks them again.
  const navItemsKey = navItems.map((n) => n.key).join('|');
  React.useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const w = tabs.scrollWidth;
    setNaturalTabsWidth((prev) => (prev === null || prev <= w ? w : prev));
  }, [navItemsKey]);

  const handleNavClick = (itemName: string) => {
    const resolvePath = (name: string) => {
      const salesItem = SALES_NAV_ITEMS.find((item) => item.name === name);
      if (salesItem) return salesItem.path;
      if (name === 'Trade') return '/';
      if (name === 'Transaction List') return '/transactions';
      if (name === 'Analytics') return '/analytics';
      if (name === 'Overview') return '/overview';
      if (name === 'User List') return '/user-list';
      return '';
    };

    const destination = resolvePath(itemName);
    if (effectiveSelected === 'ALL' && destination && destination !== '/analytics') {
      try {
        const fallback = globalThis.localStorage.getItem('lastNonAllEntity') || 'KFH';
        effectiveOnEntityChange?.(fallback);
      } catch {
        effectiveOnEntityChange?.('KFH');
      }
    }

    // Check if user has permission to access User List
    if (itemName === 'User List' && canAccessUserList === false) {
      alert('Access denied. Only CoE and Entity Admin can access User Management.');
      return;
    }

    if (destination) {
      router.push(destination);
    } else {
      console.log(`Navigating to: ${itemName}`);
    }
  };

  // Scale the tabs down when the island is too narrow to hold them at full size.
  // Available width = island content width minus the tabs' left offset (which
  // accounts for the island padding + logo + flex gap) and the island's right
  // padding. The tabs scale proportionally but never below the readable floor
  // (NAV_ITEM_MIN_SCALE).
  const ISLAND_PADDING_X_PX = 10;
  const availableTabsWidth =
    islandContentWidth !== null
      ? Math.max(0, islandContentWidth - logoAndGapWidth - ISLAND_PADDING_X_PX)
      : null;
  const navScale =
    availableTabsWidth !== null && naturalTabsWidth !== null && naturalTabsWidth > 0
      ? Math.min(1, Math.max(NAV_ITEM_MIN_SCALE, availableTabsWidth / naturalTabsWidth))
      : 1;
  const navFontSize = NAV_ITEM_MAX_FONT_PX * navScale;
  const navPaddingX = NAV_ITEM_PADDING_X_PX * navScale;

  return (
    <div className="app-topbar min-h-[65px]">
      <div className="flex h-[65px] items-center justify-between gap-[10px] px-[8px]">
        {/* Left side - Brand + navigation tabs */}
        <div
          ref={islandRef}
          className="topnav-brand-island flex h-[65px] min-w-0 flex-1 items-center whitespace-nowrap gap-[30px] px-[10px]"
          style={{ boxSizing: 'border-box', ['--topnav-tab-font-size' as any]: `${navFontSize}px` }}
        >
          <div className="flex items-center">
            <img
              src="/kfh-logo-top.png"
              alt="KFH APEX"
              style={{
                width: NAV_LOGO_WIDTH_PX,
                height: NAV_LOGO_HEIGHT_PX,
                objectFit: 'contain',
                flexShrink: 0,
                marginRight: `${NAV_LOGO_RIGHT_GAP_PX}px`,
                transform: `translate(${NAV_LOGO_OFFSET_X_PX}px, ${NAV_LOGO_OFFSET_Y_PX}px)`,
              }}
            />
          </div>
          <div ref={tabsRef} className="flex items-center gap-[3px]">
            {navItems.map((item, index) => {
              const stateClass = item.active
                ? 'topnav-tab topnav-tab--active font-bold'
                : 'topnav-tab font-medium';
              const roundedClass = `${index === 0 ? 'rounded-l' : ''} ${index === navItems.length - 1 ? 'rounded-r' : ''}`;

              if (item.isSales) {
                return (
                  <div key={item.key} ref={salesMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setSalesMenuOpen((open) => !open)}
                      aria-haspopup="menu"
                      aria-expanded={salesMenuOpen}
                      className={`flex items-center py-2 text-xs ${stateClass} ${roundedClass}`}
                      style={{
                        paddingLeft: `${navPaddingX}px`,
                        paddingRight: `${navScale * (NAV_SALES_CHEVRON_SLACK_PX + NAV_SALES_TRAILING_GAP_PX)}px`,
                        columnGap: `${navScale * NAV_SALES_CHEVRON_SLACK_PX}px`,
                      }}
                    >
                      {item.label}
                      <svg width={navScale * NAV_SALES_CHEVRON_SIZE_PX} height={navScale * NAV_SALES_CHEVRON_SIZE_PX} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {salesMenuOpen && (
                      <div className="topnav-menu absolute left-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden py-1 shadow-xl">
                        {SALES_NAV_ITEMS.map((salesItem) => (
                          <button
                            key={salesItem.path}
                            type="button"
                            onClick={() => {
                              setSalesMenuOpen(false);
                              handleNavClick(salesItem.name);
                            }}
                            className={`topnav-menu-item block w-full whitespace-nowrap px-3 py-2 text-left text-xs ${
                              activePage === salesItem.name
                                ? 'topnav-menu-item--active font-bold'
                                : 'font-medium'
                            }`}
                          >
                            {salesItem.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleNavClick(item.key)}
                  className={`py-2 text-xs ${stateClass} ${roundedClass}`}
                  style={{
                    paddingLeft: `${navPaddingX}px`,
                    paddingRight: `${navPaddingX}px`,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right side - Metrics, Accounts, then USER+Logout on rightmost */}
        <div className="flex shrink-0 items-center justify-end gap-2">
          {/* Hide METRICS and ACCOUNTS for Dealers and on the User List / Account pages */}
          {(!dealerUser && activePage !== 'User List' && activePage !== 'Account') && (
            <>
              {showWeeklyMetrics && (
              <div className="topnav-metrics rounded flex flex-col justify-center items-start px-[10px] py-[2px] topnav-box border border-[#263544]" 
                  style={{width: '350px', height: '65px', flexShrink: 0, overflow: 'hidden'}}>
                <div className="topnav-metrics-content text-white" style={{fontFamily: 'Segoe UI', fontWeight: 400, width: '100%'}}>
                  
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span className="topnav-section-label">WEEKLY METRICS</span>
                  </div>

                  <div className="topnav-metrics-body">
                    <div className="topnav-metric-row">
                      <span className="topnav-metric-label">Cumulative Position:</span>
                      <span className="topnav-metric-value topnav-metric-value--neutral" style={{marginLeft: 'auto'}}>$ {formatNumberWithCommas(Math.round(cumulativePosition))}</span>
                    </div>

                    <div className="topnav-metric-split">
                      <div className="topnav-metric-group">
                        <span className="topnav-metric-label">APM P&L:</span>
                        <span className="topnav-metric-value" style={{color: getPNLColor(apmPNLResolved), textAlign: 'right'}}>$ {formatNumberWithCommas(Math.round(apmPNLResolved))}</span>
                      </div>

                      <div className="topnav-metric-group">
                        <span className="topnav-metric-label">Sales P&L:</span>
                        <span className="topnav-metric-value" style={{color: getPNLColor(salesPNLResolved), textAlign: 'right'}}>$ {formatNumberWithCommas(Math.round(salesPNLResolved))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}
              {/* ENTITIES box for ALL entity users and Group Head Trader */}
              {(resolvedUser?.entity?.trim().toUpperCase() === 'ALL' || resolvedUser?.role === 'Group Head Trader') && (
                <div className="topnav-entity rounded flex flex-col justify-start items-start px-[10px] py-1 topnav-box border border-[#263544]" style={{width: '278px', height: '65px', flexShrink: 0, overflow: 'hidden', boxSizing: 'border-box'}}>
                  <div className="topnav-section-label topnav-entity-label">ENTITY</div>
                  <div className="flex gap-[8px] text-sm" style={{whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', margin: 0, padding: 0}}>
                    <button 
                      onClick={() => effectiveOnEntityChange?.('KFH')}
                      className={`topnav-entity-option px-2 py-1 rounded text-xs ${effectiveSelected === 'KFH' ? 'topnav-entity-option--active' : ''}`}
                    >
                      Kuwait
                    </button>
                    <button 
                      onClick={() => effectiveOnEntityChange?.('AUB')}
                      className={`topnav-entity-option px-2 py-1 rounded text-xs ${effectiveSelected === 'AUB' ? 'topnav-entity-option--active' : ''}`}
                    >
                      Bahrain
                    </button>
                    <button 
                      onClick={() => effectiveOnEntityChange?.('KT')}
                      className={`topnav-entity-option px-2 py-1 rounded text-xs ${effectiveSelected === 'KT' ? 'topnav-entity-option--active' : ''}`}
                    >
                      Turkey
                    </button>
                    <button 
                      onClick={() => effectiveOnEntityChange?.('ALL')}
                      className={`topnav-entity-option px-2 py-1 rounded text-xs ${allowAllEntitySelection ? (effectiveSelected === 'ALL' ? 'topnav-entity-option--active' : '') : 'opacity-50 cursor-not-allowed'}`}
                      disabled={!allowAllEntitySelection}
                      title={allowAllEntitySelection ? 'Aggregate all entities' : 'Group view is available only on Analytics'}
                    >
                      Group
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {resolvedUser && (
            <div className="topnav-account rounded flex flex-row justify-between items-center px-[10px] py-1 topnav-box border border-[#263544]" style={{width: '280px', height: '65px', flexShrink: 0, overflow: 'hidden'}}>
              <div className="topnav-account-details" style={{overflow: 'hidden'}}>
                <div className="text-xs text-gray-400" style={{fontSize: '8px'}}></div>
                <div className="topnav-account-name" style={{fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '15px', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', lineHeight: '18px', textTransform: 'uppercase'}}>
                  {resolvedUser.name} {resolvedUser.surname}
                </div>
                <div className="topnav-account-role" style={{fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '15px', fontWeight: 400, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', lineHeight: '16px', marginTop: '8px'}}>
                  {resolvedUser.entity ? entityLabel(resolvedUser.entity) : 'No Entity'} | {roleLabel(resolvedUser.role)}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center ml-2" style={{height: '100%'}}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'flex-start', marginTop: '2px' }}>
                    <span
                      className="topnav-icon-action topnav-icon-action--account"
                      style={{ width: '28px', height: '28px' }}
                      onClick={() => router.push('/account')}
                      title="Account"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="8" r="4" fill="white"/>
                        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span>
                      <LogoutButton onLogout={onLogout} />
                    </span>
                  </div>
                  <div style={{ marginTop: 4, width: '100%', textAlign: 'center', lineHeight: '18px' }}>
                    <span className="topnav-clock" style={{ fontSize: '15px', letterSpacing: 0, lineHeight: '18px', fontFamily: 'Segoe UI' }}>{clock}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogoutButton({ onLogout }: { onLogout?: () => void }) {
  return (
    <span
      className="topnav-icon-action topnav-icon-action--logout"
      style={{ width: '28px', height: '28px' }}
      onClick={() => {
        try { localStorage.removeItem('user'); } catch {}
        try { localStorage.removeItem('selectedEntity'); } catch {}
        try { globalThis.sessionStorage.removeItem('ui.currentUser'); } catch {}
        try { globalThis.sessionStorage.removeItem('ui.canAccessUserList'); } catch {}
        if (onLogout) {
          try { onLogout(); } catch {}
        } else {
          // Full reload to /login guarantees all in-memory state is cleared.
          fetch('/api/auth/logout', { method: 'POST' })
            .catch(() => {})
            .finally(() => { globalThis.location.href = '/login'; });
        }
      }}
      title="Logout"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 17l5-5-5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 12H9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4 4v16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}
