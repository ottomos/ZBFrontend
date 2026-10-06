"use client";
import React, { useEffect, useState } from "react";
import { formatNumberWithCommas, parseDecimalValue, withPreciousMetalUnit } from "../../lib/numberFormatter";
import { getSymbolOrder } from "../../components/tableConfig";
import { usePersistedState } from "../../lib/usePersistedState";
import { ThemedDropdown } from "../../components/ThemedDropdown";
import { OverviewTableHeaderLabel } from "../../components/OverviewTableHeaderLabel";

interface PnLRow {
  Symbol: string;
  Exposure?: number;
  USD_Equivalent?: number;
  AvgCostRate?: number;
  UnrealizedPnL?: number;
  MatchingPnL?: number;
  PositionPnL?: number;
  TotalPnL?: number;
}

interface Props {
  profile?: string;
  period?: string;
  customStart?: string;
  customEnd?: string;
  title?: string;
  onTableChange?: (key: string) => void;
  onClose?: () => void;
  refreshKey?: number;
}

const TABLE_CELL_FONT = "'Segoe UI'";
const TABLE_CELL_FONT_SIZE = "14px";
const TABLE_HEADER_FONT = "'Segoe UI'";
const TABLE_HEADER_FONT_SIZE = "14px";
const TABLE_HEADER_COLOR = "#fff";
const TABLE_HEADER_FONT_WEIGHT = "bold";
const TOTAL_ROW_LABEL = 'TOTAL ($)';

function isTotalSummaryRow(row: PnLRow) {
  const symbol = String(row.Symbol ?? '').trim();
  return /^total\b/i.test(symbol);
}

function normalizeSymbol(raw?: string | null) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const cleaned = trimmed.replace(/^[.]+/, '');
  const parts = cleaned.split(/[/\\-]/)
    .map(p => p.replace(/^[.]+/, '').trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`.toUpperCase();
  return (parts[0] ?? cleaned).toUpperCase();
}

export function PositionPnLSummaryTable({ profile = 'KFH', period = 'TODAY', customStart, customEnd, onTableChange, onClose, refreshKey }: Props) {
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const symbolOrder = React.useMemo(() => getSymbolOrder(profile), [profile]);
  const symbolSet = React.useMemo(
    () => new Set(symbolOrder.map((symbol) => String(symbol).trim().toUpperCase())),
    [symbolOrder]
  );
  const [rows, setRows] = useState<PnLRow[]>([]);
  const [searchTerm, setSearchTerm] = usePersistedState<string>('ui.search.overview.position-pnl', '');
  const [sortColumn, setSortColumn] = useState<string | null>('Symbol');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = usePersistedState<Array<{ col: string; op: string; val: string }>>('ui.filters.overview.position-pnl', []);
  const [filterCol, setFilterCol] = useState('Symbol');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterVal, setFilterVal] = useState('');
  const [filterLogic, setFilterLogic] = usePersistedState<'AND' | 'OR'>('ui.filters.overview.position-pnl.logic', 'AND');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterIconHydrated, setFilterIconHydrated] = useState(false);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useEffect(() => {
    setFilterIconHydrated(true);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateScrollbarWidth = () => {
      setScrollbarWidth(Math.max(container.offsetWidth - container.clientWidth, 0));
    };

    updateScrollbarWidth();

    const resizeObserver = new ResizeObserver(updateScrollbarWidth);
    resizeObserver.observe(container);
    window.addEventListener('resize', updateScrollbarWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollbarWidth);
    };
  }, [rows.length, searchTerm, filterPanelOpen, filters.length, sortColumn, sortDirection]);

  useEffect(() => {
    let mounted = true;
    let lastController: AbortController | null = null;
    const POLL_MS = 30000;

    async function fetchData() {
      // If parent selected CUSTOM but range is incomplete, skip fetch and preserve existing data
      if (period === 'CUSTOM' && (!customStart || !customEnd)) {
        if (!mounted) return;
        setLoading(false);
        setError(null);
        return;
      }
      if (!mounted) return;
      if (lastController) {
        try { lastController.abort(); } catch {}
      }
      const controller = new AbortController();
      lastController = controller;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ profile: profile || 'KFH', period: period || 'TODAY' });
        if (period === 'CUSTOM' && (customStart && customEnd)) {
          const dateOnly = (iso: string) => iso.split('T')[0];
          params.append('startDate', dateOnly(customStart!));
          params.append('endDate', dateOnly(customEnd!));
        }
        // Fetch PnL data (DB stored-proc proxy)
        const resp = await fetch(`/api/overview/position-pnl?${params.toString()}`, { signal: controller.signal });
        const payload = await resp.json().catch(() => null);
        if (!mounted) return;
        if (!resp.ok || payload?.success === false) {
          setError(payload?.error || `Status ${resp.status}`);
          setRows([]);
        } else {
          const pnlData: any[] = payload?.data || [];

          // Server now returns merged DB + positions data. Use fields provided by the API.
          const data = pnlData.map((r: any) => {
            const symbol = normalizeSymbol(r.Symbol ?? r.CurrencyPair ?? r.Pair ?? '');
            return {
              Symbol: symbol,
              Exposure: Number(r.Exposure ?? r.Position),
              USD_Equivalent: Number(r.USD_Equivalent ?? r['USD Equivalent'] ?? r.PositionValue ?? 0),
              AvgCostRate: Number(r.AvgCostRate ?? r['Avg Cost Rate']),
              UnrealizedPnL: Number(r.UnrealizedPnL ?? r['Unrealized PnL'] ?? 0),
              MatchingPnL: Number(r['Matching PnL'] ?? r.MatchingPNL ?? 0),
              PositionPnL: Number(r['Position PnL'] ?? r.PositionPNL ?? 0),
              TotalPnL: Number(r['Total PnL'] ?? r.TotalPNL ?? 0),
            } as PnLRow;
          });

          setRows(data);
          console.debug('[PositionPnL] pnlRows=', pnlData.length);
        }
      } catch (err: any) {
        if (!mounted) return;
        if (err?.name === 'AbortError') return;
        setError(err?.message || 'Fetch error');
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => { mounted = false; clearInterval(id); if (lastController) { try { lastController.abort(); } catch {} } };
  }, [profile, period, customStart, customEnd, refreshKey]);

  function filterRow(row: PnLRow) {
    if (filters.length === 0) return true;
    const results = filters.map(f => {
      const cell = String((row as any)[f.col] ?? '');
      const val = f.val;
      switch (f.op) {
        case 'contains': return cell.toLowerCase().includes(val.toLowerCase());
        case 'does not contain': return !cell.toLowerCase().includes(val.toLowerCase());
        case 'equals': return cell.toLowerCase() === val.toLowerCase();
        case 'does not equal': return cell.toLowerCase() !== val.toLowerCase();
        case '>': { const numCell = parseFloat(cell.replace(/[^0-9.-]+/g, '')); const numVal = parseFloat(val); return numCell > numVal; }
        case '<': { const numCell = parseFloat(cell.replace(/[^0-9.-]+/g, '')); const numVal = parseFloat(val); return numCell < numVal; }
        default: return true;
      }
    });
    return filterLogic === 'AND' ? results.every(Boolean) : results.some(Boolean);
  }

  function formatAmount(value?: number | string) {
    const parsed = parseDecimalValue(value);
    if (isNaN(parsed)) return '';
    return formatNumberWithCommas(parsed);
  }

  // Match DataTable's decimal formatting rules so AvgCostRate displays identically
  function formatDecimals(symbol: string, value?: number | string) {
    if (value === undefined || value === null) return '';
    const str = String(value);
    const num = parseFloat(str.replace(/[^0-9eE+.-]+/g, ''));
    if (isNaN(num)) return str;
    if (/^X(AU|AG|PT)\/USD$/.test(symbol)) return num.toFixed(3);
    if (/^X/.test(symbol)) return num.toFixed(3);
    if (/\/JPY$/.test(symbol)) return num.toFixed(3);
    return num.toFixed(5);
  }

  function getPnLColor(value?: number | string) {
    const v = parseDecimalValue(value);
    if (isNaN(v)) return '#fff';
    if (v === 0) return '#fff';
    return v > 0 ? '#4ade80' : '#f87171';
  }

  function handleSort(col: string) {
    if (sortColumn === col) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDirection('asc'); }
  }

  const totalRow = React.useMemo(() => rows.find(isTotalSummaryRow), [rows]);
  const normalRows = rows.filter((row) => !isTotalSummaryRow(row));
  const scopedRows = normalRows.filter((row) => symbolSet.has(String(row.Symbol ?? '').trim().toUpperCase()));
  const filtered = scopedRows.filter(r => String(r.Symbol).toLowerCase().includes(searchTerm.toLowerCase()) && filterRow(r));

  const footerRow = React.useMemo<PnLRow>(() => {
    const sum = (key: keyof PnLRow) => filtered.reduce((total, row) => total + parseDecimalValue(row[key]), 0);

    return {
      Symbol: TOTAL_ROW_LABEL,
      Exposure: null as unknown as number,
      USD_Equivalent: sum('USD_Equivalent'),
      AvgCostRate: null as unknown as number,
      UnrealizedPnL: sum('UnrealizedPnL'),
      MatchingPnL: totalRow?.MatchingPnL,
      PositionPnL: totalRow?.PositionPnL,
      TotalPnL: totalRow?.TotalPnL,
    };
  }, [filtered, totalRow]);

  const sorted = sortColumn
    ? (sortColumn === 'Symbol'
        ? [...filtered].sort((a, b) => {
          const aSym = String(a.Symbol ?? '').toUpperCase();
          const bSym = String(b.Symbol ?? '').toUpperCase();
          const aIdx = symbolOrder.findIndex(s => String(s).toUpperCase() === aSym);
          const bIdx = symbolOrder.findIndex(s => String(s).toUpperCase() === bSym);
          if (aIdx !== -1 && bIdx !== -1) return sortDirection === 'asc' ? aIdx - bIdx : bIdx - aIdx;
          if (aIdx !== -1) return sortDirection === 'asc' ? -1 : 1;
          if (bIdx !== -1) return sortDirection === 'asc' ? 1 : -1;
          return sortDirection === 'asc' ? aSym.localeCompare(bSym) : bSym.localeCompare(aSym);
        })
        : [...filtered].sort((a, b) => {
          const aVal = (a as any)[sortColumn];
          const bVal = (b as any)[sortColumn];
          const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/[^0-9.-]+/g, ''));
          const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/[^0-9.-]+/g, ''));
          if (!isNaN(aNum) && !isNaN(bNum)) return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
          return 0;
        }))
    : filtered;
  const hasActiveFilters = filters.length > 0;
  const filterIconFilled = filterIconHydrated && hasActiveFilters;

  const columns = [
    { key: 'Symbol', label: 'Symbol', width: '12%' },
    { key: 'Exposure', label: 'Exposure', width: '12.57%' },
    { key: 'USD_Equivalent', label: 'USD Equivalent', width: '12.57%' },
    { key: 'AvgCostRate', label: 'Avg Cost Rate', width: '12.57%' },
    { key: 'UnrealizedPnL', label: 'Unrealized PnL', width: '12.57%' },
    { key: 'MatchingPnL', label: 'Matching PnL', width: '12.57%' },
    { key: 'PositionPnL', label: 'Position PnL', width: '12.57%' },
    { key: 'TotalPnL', label: 'Total PnL', width: '12.57%' }
  ];

  function renderCellValue(row: PnLRow, key: string, isFooter = false) {
    if (key === 'Symbol') return isFooter ? TOTAL_ROW_LABEL : withPreciousMetalUnit(String(row.Symbol ?? '-'));

    const value = row[key as keyof PnLRow];
    if (value === undefined || value === null || value === '') return '';
    if (key === 'AvgCostRate') return formatDecimals(isFooter ? 'USD/TRY' : String(row.Symbol ?? ''), value);
    if (isFooter && key === 'UnrealizedPnL') {
      const parsed = parseDecimalValue(value);
      if (Number.isNaN(parsed)) return '';
      return formatNumberWithCommas(Number(parsed.toFixed(2)));
    }
    return formatAmount(value) || '';
  }

  function getCellColor(row: PnLRow, key: string, isFooter = false) {
    if (['UnrealizedPnL', 'MatchingPnL', 'PositionPnL', 'TotalPnL'].includes(key)) {
      const value = row[key as keyof PnLRow];
      if (!isFooter && (value === undefined || value === null || value === '')) return '#fff';
      return getPnLColor(value);
    }
    return '#fff';
  }

  return (
    <div className="overview-blue-table bg-[#102236] p-2 h-full flex flex-col" style={{ boxSizing: 'border-box', paddingBottom: 12 }}>
      <div className="table-header-controls flex items-center justify-between mb-3" style={{ marginTop: 6 }}>
        <div className="table-header-controls-inner flex items-center w-full">
          <div className="table-header-control relative flex items-center pl-4">
            <ThemedDropdown
              value="position-pnl"
              onChange={(value) => onTableChange?.(value)}
              minWidth={220}
              title="Select view"
              buttonClassName="custom-dropdown themed-dropdown-trigger overview-table-select flex items-center justify-between rounded px-3 py-1 text-white"
              buttonStyle={{ height: 32 }}
              options={[
                { value: 'client-flow-pair', label: <OverviewTableHeaderLabel type="client-flow-pair" /> },
                { value: 'client-flow-currency', label: <OverviewTableHeaderLabel type="client-flow-currency" /> },
                { value: 'interbank-execution', label: <OverviewTableHeaderLabel type="interbank-execution" /> },
                { value: 'position-pnl', label: <OverviewTableHeaderLabel type="position-pnl" /> },
              ]}
            />
          </div>
          <div className="flex items-center ml-12 gap-3">
            <span className="custom-table-search-label">Search:</span>
            <div className="table-header-control flex items-center gap-2">
              <input type="text" placeholder="Type to search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="custom-table-search-input position-pnl-search-input" />
            </div>
          </div>
          <button className="table-header-icon-btn ml-auto mr-4 flex items-center justify-center bg-transparent border-none p-0" onClick={() => setFilterPanelOpen(v => !v)} title={filterPanelOpen ? 'Hide Filter Panel' : 'Show Filter Panel'} style={{ cursor: 'pointer', background: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill={filterIconFilled ? '#FFFFFF' : 'none'} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
              <path d="M4 6.5C4 5.94772 4.44772 5.5 5 5.5H23C23.5523 5.5 24 5.94772 24 6.5V8.5C24 8.76522 23.8946 9.01957 23.7071 9.20711L17 15.9142V22.5C17 22.7761 16.7761 23 16.5 23H11.5C11.2239 23 11 22.7761 11 22.5V15.9142L4.29289 9.20711C4.10536 9.01957 4 8.76522 4 8.5V6.5Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill={filterIconFilled ? '#FFFFFF' : 'none'} />
            </svg>
          </button>
        </div>
      </div>

      {filterPanelOpen && (
        <div className="bg-[#1A334C] rounded-lg p-3 mb-4 flex flex-col gap-2 w-full" style={{ width: '100%' }}>
          <div className="flex gap-2 items-center mb-2">
            <span className="filter-panel-select-xs" style={{fontSize:11, fontWeight:'normal', color:'#fff'}}>Col:</span>
            <ThemedDropdown
              value={filterCol}
              onChange={setFilterCol}
              minWidth={140}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={columns.map(col => ({ value: col.key, label: col.label }))}
            />
            <span className="filter-panel-select-xs" style={{fontSize:11, fontWeight:'normal', color:'#fff'}}>Op:</span>
            <ThemedDropdown
              value={filterOp}
              onChange={setFilterOp}
              minWidth={130}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={[
                { value: 'contains', label: 'contains' },
                { value: 'does not contain', label: 'does not contain' },
                { value: 'equals', label: 'equals' },
                { value: 'does not equal', label: 'does not equal' },
                { value: '>', label: '>' },
                { value: '<', label: '<' },
              ]}
            />
            <span className="filter-panel-select-xs" style={{fontSize:11, fontWeight:'normal', color:'#fff'}}>Val:</span>
            <input value={filterVal} onChange={e => setFilterVal(e.target.value)} className="px-2 py-1 rounded bg-[#102236] text-white filter-panel-select-xs" style={{ minWidth: 100, fontSize:11, fontWeight:'normal' }} />
            <div className="flex-1" />
            <button className="px-2 py-1 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{ minWidth: '90px', fontSize:11, fontWeight:'normal' }} onClick={() => { if (!filterVal) return; setFilters(f => [...f, { col: filterCol, op: filterOp, val: filterVal }]); setFilterVal(''); }}>Add Filter</button>
          </div>
          <div className="mb-2">
            <span style={{fontSize:11, fontWeight:'normal', fontFamily:'Segoe UI', color:'#fff'}}>Current Filters:</span>
            <ul className="bg-[#102236] rounded p-2 mt-1" style={{ minHeight: 40 }}>
              {filters.map((f, i) => (<li key={i} className="text-white flex items-center gap-2 mb-1 filter-panel-label" style={{fontSize:11, fontWeight:'normal'}}><span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal'}}>{f.col} {f.op} {f.val}</span><button className="px-2 py-0.5 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{fontSize:11, fontWeight:'normal'}} onClick={() => setFilters(fs => fs.filter((_, idx) => idx !== i))}>Remove</button></li>))}
              {filters.length === 0 && <li className="text-gray-400" style={{fontSize:11, fontFamily:'Segoe UI',fontWeight:'normal'}}>No filters added.</li>}
            </ul>
          </div>
          <div className="flex gap-2 items-center">
            <span className="filter-panel-select-xs" style={{fontSize:11, fontWeight:'normal', fontFamily:'Segoe UI', color:'#fff'}}>Logic:</span>
            <ThemedDropdown
              value={filterLogic}
              onChange={(v) => setFilterLogic(v as 'AND' | 'OR')}
              minWidth={80}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={[
                { value: 'AND', label: 'AND' },
                { value: 'OR', label: 'OR' },
              ]}
            />
            <button className="px-3 py-1 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{ minWidth: '90px', fontSize:11, fontWeight:'normal' }} onClick={() => setFilterPanelOpen(false)}>Apply</button>
            <button className="px-3 py-1 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{ minWidth: '90px', fontSize:11, fontWeight:'normal' }} onClick={() => setFilters([])}>Clear All</button>
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
        <table className="w-full text-sm table-mono table-fixed">
          <colgroup>
            {columns.map(col => (<col key={col.key} style={{ width: col.width }} />))}
          </colgroup>
          <thead className="sticky top-0 bg-[#1A334C] z-10">
            <tr className="text-gray-300">
              {columns.map(col => (
                <th key={col.key} className="py-1 px-2 text-center border-r border-gray-600 cursor-pointer select-none" onClick={() => handleSort(col.key)} style={{ userSelect: 'none', position: 'relative', whiteSpace: 'nowrap', fontFamily: TABLE_HEADER_FONT, fontSize: TABLE_HEADER_FONT_SIZE, color: TABLE_HEADER_COLOR, fontWeight: TABLE_HEADER_FONT_WEIGHT }}>
                  {col.label}
                  {sortColumn === col.key && (<span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#aaa' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr key={`${row.Symbol}-${idx}`} className={`border-b border-gray-700 hover:bg-[#263544]/50 h-7`} style={{ backgroundColor: idx % 2 === 0 ? '#0A1929' : '#102236' }}>
                {columns.map((col) => (
                  <td key={col.key} className="py-1 px-2 border-r border-gray-600 text-xs text-center" style={{ fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: getCellColor(row, col.key) }}>
                    {renderCellValue(row, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-[#102133]" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.35)', paddingRight: scrollbarWidth > 0 ? `${scrollbarWidth}px` : 0, boxSizing: 'border-box' }}>
        <table className="w-full text-sm table-mono table-fixed">
          <colgroup>
            {columns.map(col => (<col key={`footer-${col.key}`} style={{ width: col.width }} />))}
          </colgroup>
          <tfoot>
            <tr className="h-7" style={{ backgroundColor: '#102133', fontWeight: 'bold' }}>
              {columns.map((col) => (
                <td key={`total-${col.key}`} className="py-1 px-2 border-r border-gray-600 text-xs text-center" style={{ fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: getCellColor(footerRow, col.key, true), backgroundColor: '#102133', fontWeight: 700 }}>
                  <span style={{ fontWeight: 700 }}>{renderCellValue(footerRow, col.key, true)}</span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default PositionPnLSummaryTable;