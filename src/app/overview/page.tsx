"use client";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { ClientFlowSummaryReportPairTable } from "./tables/ClientFlowSummaryReportPairTable";
import { ClientFlowSummaryReportCurrencyTable } from "./tables/ClientFlowSummaryReportCurrencyTable";
import InterbankExecutionSummaryTable from "./tables/InterbankExecutionSummaryTable";
import PositionPnLSummaryTable from "./tables/PositionPnLSummaryTable";
import { ThemedDropdown } from "../components/ThemedDropdown";
import MiniDatePicker from "../components/MiniDatePicker";
import { useEntity } from "../context/EntityContext";
import { User } from "../types/user";
import { TableContainer } from "../components/TableContainer";
import { SplitBar } from "../components/SplitBar";
import { usePersistedState } from "../lib/usePersistedState";

type ClientFlowRow = {
  Symbol: string;
  TotalAmount: number;
  ClientBuyAmount: number;
  ClientSellAmount: number;
  NetAmount: number;
  SalesPnL: number;
};

export default function OverviewPage() {
  const router = useRouter();
  const { selectedEntity, setSelectedEntity } = useEntity();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isUserResolved, setIsUserResolved] = useState(false);
  const [rows, setRows] = useState<ClientFlowRow[]>([]);
  const [status, setStatus] = useState({ loading: true, error: "" });

  // layout state (2x2 grid)
  const [rowHeights, setRowHeights] = usePersistedState('ui.layout.overview.rowHeights', [0.5, 0.5]);
  const [topColWidths, setTopColWidths] = usePersistedState('ui.layout.overview.topColWidths', [0.5, 0.5]);
  const [bottomColWidths, setBottomColWidths] = usePersistedState('ui.layout.overview.bottomColWidths', [0.5, 0.5]);

  // which quadrants are visible
  const [visibleTables, setVisibleTables] = useState({
    topLeft: true,
    topRight: true,
    bottomLeft: true,
    bottomRight: true,
  });

  // table type per quadrant (defaults: top-left Position & PnL, top-right Pair, bottom-left Interbank, bottom-right Currency)
  const [topLeftType, setTopLeftType] = useState('position-pnl');
  const [topRightType, setTopRightType] = useState('client-flow-pair');
  const [bottomLeftType, setBottomLeftType] = useState('interbank-execution');
  const [bottomRightType, setBottomRightType] = useState('client-flow-currency');
  // client-flow variant per quadrant: 'internal' or 'customer'
  const [topLeftVariant, setTopLeftVariant] = useState<'internal' | 'customer'>('internal');
  const [topRightVariant, setTopRightVariant] = useState<'internal' | 'customer'>('internal');
  const [bottomLeftVariant, setBottomLeftVariant] = useState<'internal' | 'customer'>('internal');
  const [bottomRightVariant, setBottomRightVariant] = useState<'internal' | 'customer'>('internal');
  // selected time period for overview tables — shared across Overview and Analytics pages.
  const [period, setPeriod] = usePersistedState<string>('ui.shared.period', 'TODAY');
  // refresh key to force child tables to re-fetch immediately
  const [refreshKey, setRefreshKey] = useState<number>(0);
  // custom range inputs (enabled only when period === 'CUSTOM') — shared across pages.
  const [customStart, setCustomStart] = usePersistedState<string>('ui.shared.customStart', '');
  const [customEnd, setCustomEnd] = usePersistedState<string>('ui.shared.customEnd', '');
  const [customError, setCustomError] = useState<string>('');
  // temporary selections while the pair is being chosen (not applied until both valid)
  const [tempStart, setTempStart] = usePersistedState<string>('ui.shared.tempStart', '');
  const [tempEnd, setTempEnd] = usePersistedState<string>('ui.shared.tempEnd', '');

  const normalizedSelectedEntity = String(selectedEntity || '').trim().toUpperCase();
  const normalizedUserEntity = String(currentUser?.entity || '').trim().toUpperCase();
  const isCoEUser = normalizedUserEntity === 'ALL';
  const isGroupHeadTrader = String(currentUser?.role || '').trim().toUpperCase() === 'GROUP HEAD TRADER';
  let activeEntity = '';
  if (isUserResolved) {
    if (!isCoEUser && !isGroupHeadTrader && normalizedUserEntity) {
      activeEntity = normalizedUserEntity;
    } else {
      activeEntity = normalizedSelectedEntity || 'KFH';
    }
  }

  function formatLocalDatetime(input: string): string | null {
    if (!input) return null;
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = parsed.getFullYear();
    const m = pad(parsed.getMonth() + 1);
    const d = pad(parsed.getDate());
    const hh = pad(parsed.getHours());
    const mm = pad(parsed.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function validateAndSetCustom(startVal: string, endVal: string) {
    setCustomError('');
    // update temporary selections always
    setTempStart(startVal || '');
    setTempEnd(endVal || '');

    const s = formatLocalDatetime(startVal);
    const e = formatLocalDatetime(endVal);

    // If neither provided, clear official state
    if (!startVal && !endVal) {
      setCustomStart('');
      setCustomEnd('');
      setCustomError('');
      return false;
    }

    // If one side missing, don't apply yet — just keep temp
    if (!startVal || !endVal) {
      return false;
    }

    // Both provided: validate parse
    if (!s || !e) {
      setCustomError('Invalid date/time');
      return false;
    }
    // Allow Begin date to be the same as End date (inclusive range)
    if (new Date(s) > new Date(e)) {
      setCustomError('Begin must be before or equal to End');
      return false;
    }

    // Both valid: apply official custom range used by fetch
    setCustomStart(s);
    setCustomEnd(e);
    setCustomError('');
    return true;
  }

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    fetch('/api/users/me', { signal: controller.signal })
      .then(res => res.json())
      .then((payload) => {
        if (!mounted || !payload?.success || !payload?.user) return;

        setCurrentUser(payload.user);

        const normalizedFetchedEntity = String(payload.user.entity || '').trim().toUpperCase();
        const normalizedRole = String(payload.user.role || '').trim().toUpperCase();
        const fetchedIsCoE = normalizedFetchedEntity === 'ALL';
        const fetchedIsGroupHeadTrader = normalizedRole === 'GROUP HEAD TRADER';

        if (!fetchedIsCoE && !fetchedIsGroupHeadTrader && normalizedFetchedEntity && normalizedSelectedEntity !== normalizedFetchedEntity) {
          setSelectedEntity(String(payload.user.entity || '').trim());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setIsUserResolved(true);
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [normalizedSelectedEntity, setSelectedEntity]);

  useEffect(() => {
    let mounted = true;
    let lastController: AbortController | null = null;
    const POLL_MS = 30000;

    async function doFetch() {
      if (!isUserResolved || !activeEntity) return;
      if (!mounted) return;
      if (lastController) {
        try { lastController.abort(); } catch {}
      }
      const controller = new AbortController();
      lastController = controller;
      // If the user selected CUSTOM but the custom range is incomplete or invalid,
      // do not make an API request. This prevents sending stale or partial ranges
      // after the user starts editing them.
      if (period === 'CUSTOM') {
        if (!customStart || !customEnd || customError) {
          // Custom range incomplete or invalid — do not perform an API request.
          // Preserve previously-loaded table data (do not clear parent tables).
          if (!mounted) return;
          setStatus({ loading: false, error: customError || '' });
          return;
        }
      }

      const params = new URLSearchParams({ profile: activeEntity, period: period || "TODAY" });
      if (period === 'CUSTOM' && customStart && customEnd && !customError) {
        // For DB calls from Overview, send date-only (no hours/minutes)
        const dateOnly = (iso: string) => iso.split('T')[0];
        params.append('startDate', dateOnly(customStart));
        params.append('endDate', dateOnly(customEnd));
      }
      const targetUrl = `/api/overview/client-flow-pair?${params.toString()}`;
      setStatus({ loading: true, error: "" });
      try {
        const response = await fetch(targetUrl, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || `Unexpected status ${response.status}`);
        }
        const normalized = (payload?.data ?? []).map((row: Record<string, unknown>) => mapClientFlowRow(row));
        if (!mounted) return;
        setRows(normalized);
        setStatus({ loading: false, error: "" });
      } catch (error: any) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Failed to load client flow summary";
        if (!mounted) return;
        setStatus({ loading: false, error: message });
      }
    }

    // initial fetch and then poll
    doFetch();
    const intervalId = setInterval(doFetch, POLL_MS);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (lastController) {
        try { lastController.abort(); } catch {}
      }
    };
  }, [activeEntity, isUserResolved, period, customStart, customEnd, customError]);

  // Split bar handlers
  const handleTopColSplitDrag = (delta: number) => {
    const container = document.getElementById('overview-table-container');
    if (!container) return;
    const width = container.clientWidth;
    const percentDelta = delta / width;
    setTopColWidths(prev => {
      let left = Math.max(prev[0] + percentDelta, 0.2);
      let right = Math.max(prev[1] - percentDelta, 0.2);
      const total = left + right;
      return [left / total, right / total];
    });
  };
  const handleBottomColSplitDrag = (delta: number) => {
    const container = document.getElementById('overview-table-container');
    if (!container) return;
    const width = container.clientWidth;
    const percentDelta = delta / width;
    setBottomColWidths(prev => {
      let left = Math.max(prev[0] + percentDelta, 0.2);
      let right = Math.max(prev[1] - percentDelta, 0.2);
      const total = left + right;
      return [left / total, right / total];
    });
  };
  const handleRowSplitDrag = (delta: number) => {
    const container = document.getElementById('overview-table-container');
    if (!container) return;
    const height = container.clientHeight;
    const percentDelta = delta / height;
    setRowHeights(prev => {
      let up = Math.max(prev[0] + percentDelta, 0.2);
      let down = Math.max(prev[1] - percentDelta, 0.2);
      const total = up + down;
      return [up / total, down / total];
    });
  };

  const handleRemoveTable = (quadrant: string) => {
    setVisibleTables(prev => ({ ...prev, [quadrant]: false }));
  };

  const handleLogout = () => {
    fetch('/api/users/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
  };

  return (
    <div className="h-full bg-[#0A1929] flex flex-col overflow-hidden">
      <div className="flex items-center gap-3" style={{ marginLeft: '8px', marginBottom: '0px', marginTop: '-4px' }}>
        <ThemedDropdown
          value={period}
          onChange={(value) => { setPeriod(value); setRefreshKey(k => k + 1); }}
          width={160}
          title="Period"
          buttonClassName="themed-dropdown-trigger overview-period-select flex items-center justify-between rounded px-3 text-white"
          buttonStyle={{ height: 32, marginLeft: 8, paddingTop: 0, paddingBottom: 0, lineHeight: '32px' }}
          options={[
            { value: 'TODAY', label: 'Today' },
            { value: 'WTD', label: 'Week-to-date' },
            { value: 'MTD', label: 'Month-to-date' },
            { value: 'QTD', label: 'Quarter-to-date' },
            { value: 'YTD', label: 'Year-to-date' },
            { value: 'CUSTOM', label: 'Custom' },
          ]}
        />
        {/* Custom start/end inputs: show only when CUSTOM is selected */}
        {period === 'CUSTOM' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
            <MiniDatePicker
              label="Begin Date"
              value={tempStart || customStart || null}
              minDate="2026-01-01T00:00"
              onChange={(iso) => {
                const formatted = formatLocalDatetime(iso) || '';
                // update temporary and attempt to validate/apply
                validateAndSetCustom(formatted, tempEnd);
              }}
            />
            <MiniDatePicker
              label="End Date"
              value={tempEnd || customEnd || null}
              minDate="2026-01-01T00:00"
              onChange={(iso) => {
                const formatted = formatLocalDatetime(iso) || '';
                // update temporary and attempt to validate/apply
                validateAndSetCustom(tempStart, formatted);
              }}
            />
          </div>
        )}
        {customError && <div style={{ color: '#FF4757', marginLeft: 8, fontSize: 13, fontFamily: 'Segoe UI' }}>{customError}</div>}
        <div style={{ marginLeft: 'auto', marginRight: 8, fontSize: 12, fontStyle: 'italic', color: '#9CA3AF', fontFamily: 'Segoe UI', whiteSpace: 'nowrap' }}>
          * Amounts are shown in the base currency, while P&amp;L values are displayed in USD.
        </div>
      </div>
      <div className="flex-1 p-1 overflow-hidden">
        {!activeEntity ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#9CA3AF]">
            Loading overview...
          </div>
        ) : (
        <div className="h-full w-full relative" id="overview-table-container">
          {/* Horizontal Split Bar between rows */}
          {(visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) && (
            <div
              className="absolute"
              style={{
                top: `calc(${rowHeights[0] * 100}% - 12px)`,
                left: 0,
                width: '100%',
                height: '4px',
                zIndex: 30,
              }}
            >
              <SplitBar direction="horizontal" onDrag={handleRowSplitDrag} />
            </div>
          )}

          {/* Top row */}
          <div
            className="absolute"
            style={{
              top: 0,
              left: 0,
              height: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[0] * 100}%)` : '100%',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: visibleTables.topLeft && visibleTables.topRight ? topColWidths.map(w => `${w * 100}%`).join(' ') : '1fr',
            }}
          >
            {visibleTables.topLeft && (
              <div style={{ overflow: 'hidden' }}>
                <TableContainer>
                  {topLeftType === 'client-flow-pair' ? (
                    <ClientFlowSummaryReportPairTable
                      profile={activeEntity}
                      rows={rows}
                      currentType={topLeftVariant}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setTopLeftVariant(v as 'internal' | 'customer');
                        else setTopLeftType(v);
                      }}
                      onClose={() => handleRemoveTable('topLeft')}
                    />
                  ) : topLeftType === 'client-flow-currency' ? (
                    <ClientFlowSummaryReportCurrencyTable
                      profile={activeEntity}
                      period={period}
                      customStart={customStart}
                        customEnd={customEnd}
                        refreshKey={refreshKey}
                      rows={rows.map(r => ({ Symbol: r.Symbol, TotalBuyAmount: r.ClientBuyAmount, TotalSellAmount: r.ClientSellAmount, NetAmount: r.NetAmount }))}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setTopLeftVariant(v as 'internal' | 'customer');
                        else setTopLeftType(v);
                      }}
                      onClose={() => handleRemoveTable('topLeft')}
                    />
                  ) : topLeftType === 'position-pnl' ? (
                    <PositionPnLSummaryTable
                      profile={activeEntity}
                      period={period}
                        customStart={customStart}
                        customEnd={customEnd}
                        refreshKey={refreshKey}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setTopLeftVariant(v as 'internal' | 'customer');
                        else setTopLeftType(v);
                      }}
                      onClose={() => handleRemoveTable('topLeft')}
                    />
                  ) : topLeftType === 'interbank-execution' ? (
                    <InterbankExecutionSummaryTable
                      profile={activeEntity}
                      period={period}
                      customStart={customStart}
                      customEnd={customEnd}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setTopLeftVariant(v as 'internal' | 'customer');
                        else setTopLeftType(v);
                      }}
                      onClose={() => handleRemoveTable('topLeft')}
                    />
                  ) : (
                    <div className="p-4 text-white">Table: {topLeftType} not implemented in Overview preview.</div>
                  )}
                </TableContainer>
              </div>
            )}
            {visibleTables.topRight && (
              <div style={{ overflow: 'hidden' }}>
                <TableContainer>
                  {topRightType === 'client-flow-pair' ? (
                    <ClientFlowSummaryReportPairTable
                      profile={activeEntity}
                      rows={rows}
                      currentType={topRightVariant}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setTopRightVariant(v as 'internal' | 'customer');
                        else setTopRightType(v);
                      }}
                      onClose={() => handleRemoveTable('topRight')}
                    />
                  ) : topRightType === 'client-flow-currency' ? (
                    <ClientFlowSummaryReportCurrencyTable
                      profile={activeEntity}
                      period={period}
                      customStart={customStart}
                      customEnd={customEnd}
                      refreshKey={refreshKey}
                      rows={rows.map(r => ({ Symbol: r.Symbol, TotalBuyAmount: r.ClientBuyAmount, TotalSellAmount: r.ClientSellAmount, NetAmount: r.NetAmount }))}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setTopRightVariant(v as 'internal' | 'customer');
                        else setTopRightType(v);
                      }}
                      onClose={() => handleRemoveTable('topRight')}
                    />
                  ) : topRightType === 'position-pnl' ? (
                    <PositionPnLSummaryTable
                      profile={activeEntity}
                      period={period}
                      customStart={customStart}
                      customEnd={customEnd}
                      refreshKey={refreshKey}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setTopRightVariant(v as 'internal' | 'customer');
                        else setTopRightType(v);
                      }}
                      onClose={() => handleRemoveTable('topRight')}
                    />
                  ) : topRightType === 'interbank-execution' ? (
                    <InterbankExecutionSummaryTable
                       profile={activeEntity}
                       period={period}
                       customStart={customStart}
                       customEnd={customEnd}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setTopRightVariant(v as 'internal' | 'customer');
                        else setTopRightType(v);
                      }}
                      onClose={() => handleRemoveTable('topRight')}
                    />
                  ) : (
                    <div className="p-4 text-white">Table: {topRightType} not implemented in Overview preview.</div>
                  )}
                </TableContainer>
              </div>
            )}
          </div>

          {/* Vertical Split Bar for top row */}
          {visibleTables.topLeft && visibleTables.topRight && (
            <div
              className="absolute"
              style={{
                top: 0,
                left: `calc(${topColWidths[0] * 100}%)`,
                height: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[0] * 100}%)` : '100%',
                width: '4px',
                zIndex: 20,
              }}
            >
              <SplitBar direction="vertical" onDrag={handleTopColSplitDrag} />
            </div>
          )}

          {/* Bottom row */}
          <div
            className="absolute"
            style={{
              top: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[0] * 100}%)` : '0',
              left: 0,
              height: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[1] * 100}%)` : '100%',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: visibleTables.bottomLeft && visibleTables.bottomRight ? bottomColWidths.map(w => `${w * 100}%`).join(' ') : '1fr',
            }}
          >
            {visibleTables.bottomLeft && (
              <div style={{ overflow: 'hidden' }}>
                <TableContainer>
                  {bottomLeftType === 'client-flow-pair' ? (
                    <ClientFlowSummaryReportPairTable
                      profile={activeEntity}
                      rows={rows}
                      currentType={bottomLeftVariant}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setBottomLeftVariant(v as 'internal' | 'customer');
                        else setBottomLeftType(v);
                      }}
                      onClose={() => handleRemoveTable('bottomLeft')}
                    />
                  ) : bottomLeftType === 'client-flow-currency' ? (
                    <ClientFlowSummaryReportCurrencyTable
                       profile={activeEntity}
                       period={period}
                       customStart={customStart}
                       customEnd={customEnd}
                       refreshKey={refreshKey}
                      rows={rows.map(r => ({ Symbol: r.Symbol, TotalBuyAmount: r.ClientBuyAmount, TotalSellAmount: r.ClientSellAmount, NetAmount: r.NetAmount }))}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setBottomLeftVariant(v as 'internal' | 'customer');
                        else setBottomLeftType(v);
                      }}
                      onClose={() => handleRemoveTable('bottomLeft')}
                    />
                  ) : bottomLeftType === 'position-pnl' ? (
                    <PositionPnLSummaryTable
                      profile={activeEntity}
                      period={period}
                      customStart={customStart}
                      customEnd={customEnd}
                      refreshKey={refreshKey}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setBottomLeftVariant(v as 'internal' | 'customer');
                        else setBottomLeftType(v);
                      }}
                      onClose={() => handleRemoveTable('bottomLeft')}
                    />
                  ) : bottomLeftType === 'interbank-execution' ? (
                    <InterbankExecutionSummaryTable
                       profile={activeEntity}
                       period={period}
                       customStart={customStart}
                       customEnd={customEnd}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setBottomLeftVariant(v as 'internal' | 'customer');
                        else setBottomLeftType(v);
                      }}
                      onClose={() => handleRemoveTable('bottomLeft')}
                    />
                  ) : (
                    <div className="p-4 text-white">Table: {bottomLeftType} not implemented in Overview preview.</div>
                  )}
                </TableContainer>
              </div>
            )}
            {visibleTables.bottomRight && (
              <div style={{ overflow: 'hidden' }}>
                <TableContainer>
                  {bottomRightType === 'client-flow-pair' ? (
                    <ClientFlowSummaryReportPairTable
                      profile={activeEntity}
                      rows={rows}
                      currentType={bottomRightVariant}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setBottomRightVariant(v as 'internal' | 'customer');
                        else setBottomRightType(v);
                      }}
                      onClose={() => handleRemoveTable('bottomRight')}
                    />
                  ) : bottomRightType === 'client-flow-currency' ? (
                    <ClientFlowSummaryReportCurrencyTable
                       profile={activeEntity}
                       period={period}
                       customStart={customStart}
                       customEnd={customEnd}
                       refreshKey={refreshKey}
                      rows={rows.map(r => ({ Symbol: r.Symbol, TotalBuyAmount: r.ClientBuyAmount, TotalSellAmount: r.ClientSellAmount, NetAmount: r.NetAmount }))}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setBottomRightVariant(v as 'internal' | 'customer');
                        else setBottomRightType(v);
                      }}
                      onClose={() => handleRemoveTable('bottomRight')}
                    />
                  ) : bottomRightType === 'position-pnl' ? (
                    <PositionPnLSummaryTable
                      profile={activeEntity}
                      period={period}
                      customStart={customStart}
                      customEnd={customEnd}
                      refreshKey={refreshKey}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setBottomRightVariant(v as 'internal' | 'customer');
                        else setBottomRightType(v);
                      }}
                      onClose={() => handleRemoveTable('bottomRight')}
                    />
                  ) : bottomRightType === 'interbank-execution' ? (
                    <InterbankExecutionSummaryTable
                      profile={activeEntity}
                      period={period}
                      onTableChange={(v) => {
                        if (v === 'internal' || v === 'customer') setBottomRightVariant(v as 'internal' | 'customer');
                        else setBottomRightType(v);
                      }}
                      onClose={() => handleRemoveTable('bottomRight')}
                    />
                  ) : (
                    <div className="p-4 text-white">Table: {bottomRightType} not implemented in Overview preview.</div>
                  )}
                </TableContainer>
              </div>
            )}
          </div>

          {/* Vertical Split Bar for bottom row */}
          {visibleTables.bottomLeft && visibleTables.bottomRight && (
            <div
              className="absolute"
              style={{
                top: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[0] * 100}%)` : '0',
                left: `calc(${bottomColWidths[0] * 100}%)`,
                height: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[1] * 100}% - 8px)` : '100%',
                width: '4px',
                zIndex: 20,
              }}
            >
              <SplitBar direction="vertical" onDrag={handleBottomColSplitDrag} />
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

function mapClientFlowRow(row: Record<string, unknown>): ClientFlowRow {
  const symbol = String(row.Symbol ?? row.CurrencyPair ?? row.Pair ?? "-");
  const totalAmount = normalizeNumber(row["Total Amount"] ?? row.TotalAmount ?? 0);
  const clientBuyAmount = normalizeNumber(row["Client Buy Amount"] ?? row.ClientBuyAmount ?? 0);
  const clientSellAmount = normalizeNumber(row["Client Sell Amount"] ?? row.ClientSellAmount ?? 0);
  const netAmount = normalizeNumber(row["Net Amount"] ?? row.NetAmount ?? 0);
  const salesPnL = normalizeNumber(row["Sales PnL"] ?? row.SalesPnL ?? 0);
  return {
    Symbol: symbol,
    TotalAmount: totalAmount,
    ClientBuyAmount: clientBuyAmount,
    ClientSellAmount: clientSellAmount,
    NetAmount: netAmount,
    SalesPnL: salesPnL,
  };
}

function normalizeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
