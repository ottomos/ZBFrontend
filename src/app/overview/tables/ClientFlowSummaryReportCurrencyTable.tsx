"use client";
import React, { useState } from "react";
import { useEffect } from "react";
import { formatNumberWithCommas, parseDecimalValue, withPreciousMetalUnit } from "../../lib/numberFormatter";
import { usePersistedState } from "../../lib/usePersistedState";
import { ThemedDropdown } from "../../components/ThemedDropdown";
import { OverviewTableHeaderLabel } from "../../components/OverviewTableHeaderLabel";

interface CurrencyRow {
  Symbol: string;
  TotalBuyAmount: number;
  TotalSellAmount: number;
  NetAmount: number;
  Timestamp?: string;
  [key: string]: string | number | undefined;
}

interface Props {
  rows?: CurrencyRow[];
  profile?: string;
  period?: string;
  customStart?: string;
  customEnd?: string;
  title?: string;
  currentType?: string;
  onTableChange?: (tableKey: string) => void;
  onClose?: () => void;
  refreshKey?: number;
}

const TABLE_CELL_FONT = "'Segoe UI'";
const TABLE_CELL_FONT_SIZE = "14px";
const TABLE_HEADER_FONT = "'Segoe UI'";
const TABLE_HEADER_FONT_SIZE = "14px";
const TABLE_HEADER_COLOR = "#fff";
const TABLE_HEADER_FONT_WEIGHT = "bold";

export function ClientFlowSummaryReportCurrencyTable({ rows = [], profile = 'KFH', period = 'TODAY', customStart, customEnd, title, onTableChange, onClose, refreshKey }: Props) {
  const [searchTerm, setSearchTerm] = usePersistedState<string>('ui.search.overview.client-flow-currency', '');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = usePersistedState<Array<{ col: string; op: string; val: string }>>('ui.filters.overview.client-flow-currency', []);
  const [filterCol, setFilterCol] = useState('Symbol');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterVal, setFilterVal] = useState('');
  const [filterLogic, setFilterLogic] = usePersistedState<'AND' | 'OR'>('ui.filters.overview.client-flow-currency.logic', 'AND');
  const [sortColumn, setSortColumn] = useState<string | null>("Symbol");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // Always drive this table from the DB API only (do not aggregate parent `rows`)
  const [dataRows, setDataRows] = useState<CurrencyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterIconHydrated, setFilterIconHydrated] = useState(false);

  useEffect(() => {
    setFilterIconHydrated(true);
  }, []);

  // NOTE: intentionally do not consume `rows` prop — this table shows DB API data only.

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
          const resp = await fetch(`/api/overview/client-flow-currency?${params.toString()}`, { signal: controller.signal });
        const payload = await resp.json().catch(() => null);
        if (!mounted) return;
        if (!resp.ok || payload?.success === false) {
          setError(payload?.error || `Status ${resp.status}`);
          // preserve existing dataRows on error (do not clear the table)
        } else {
          const raw = (payload?.data || []).map((r: any) => ({
            Symbol: String(r.Symbol ?? r.symbol ?? r.Currency ?? r.currency ?? r.CurrencyPair ?? ''),
            TotalBuyAmount: Number(r.TotalBuyAmount ?? r['Total Buy Amount'] ?? r.TotalBuy ?? 0),
            TotalSellAmount: Number(r.TotalSellAmount ?? r['Total Sell Amount'] ?? r.TotalSell ?? 0),
            NetAmount: Number(r.NetAmount ?? r['Net Amount'] ?? r.NetAmount ?? 0),
          }));
          // Do not aggregate; show API rows directly (same behaviour as pair table)
          setDataRows(raw);
        }
      } catch (err: any) {
        if (!mounted) return;
        if (err?.name === 'AbortError') return;
        setError(err?.message || 'Fetch error');
        // keep previous data on network error
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    const intervalId = setInterval(fetchData, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (lastController) {
        try { lastController.abort(); } catch {}
      }
    };
  }, [profile, period, customStart, customEnd, refreshKey]);

  const columns = [
    { key: 'Symbol', label: 'Symbol' },
    { key: 'TotalBuyAmount', label: 'Total Buy Amount' },
    { key: 'TotalSellAmount', label: 'Total Sell Amount' },
    { key: 'NetAmount', label: 'Net Amount' }
  ];

  

  function filterRow(row: CurrencyRow) {
    if (filters.length === 0) return true;
    const results = filters.map(f => {
      const cell = String(row[f.col as keyof CurrencyRow] ?? '');
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

  function getNumericColor(value?: number | string) {
    const parsed = parseDecimalValue(value as any);
    if (isNaN(parsed)) return '#fff';
    if (parsed > 0) return '#2ECC71';
    if (parsed < 0) return '#FF4757';
    return '#fff';
  }

  function handleSort(col: string) {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  }

  const filtered = dataRows.filter(r => String(r.Symbol).toLowerCase().includes(searchTerm.toLowerCase()) && filterRow(r));

  const sorted = sortColumn
    ? [...filtered].sort((a, b) => {
      const aVal = a[sortColumn as keyof CurrencyRow];
      const bVal = b[sortColumn as keyof CurrencyRow];
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal ?? '0').replace(/[^0-9.-]+/g, ''));
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal ?? '0').replace(/[^0-9.-]+/g, ''));
      if (!isNaN(aNum) && !isNaN(bNum)) return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      return sortDirection === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    })
    : filtered;
  const hasActiveFilters = filters.length > 0;
  const filterIconFilled = filterIconHydrated && hasActiveFilters;

  return (
    <div className="overview-blue-table bg-[#102236] p-2 h-full flex flex-col" style={{ boxSizing: 'border-box', paddingBottom: 12 }}>
      <div className="table-header-controls flex items-center justify-between mb-3" style={{ marginTop: 6 }}>
        <div className="table-header-controls-inner flex items-center w-full">
          <div className="table-header-control relative flex items-center pl-4">
            <ThemedDropdown
              value={title?.includes('pair') ? 'client-flow-pair' : 'client-flow-currency'}
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
              <input
                type="text"
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="custom-table-search-input"
              />
            </div>
          </div>
          <button
            className="table-header-icon-btn ml-auto mr-5 flex items-center justify-center bg-transparent border-none p-0"
            onClick={() => setFilterPanelOpen(v => !v)}
            title={filterPanelOpen ? 'Hide Filter Panel' : 'Show Filter Panel'}
            style={{ cursor: 'pointer', background: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 28 28" fill={filterIconFilled ? '#FFFFFF' : 'none'} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
              <path d="M4 6.5C4 5.94772 4.44772 5.5 5 5.5H23C23.5523 5.5 24 5.94772 24 6.5V8.5C24 8.76522 23.8946 9.01957 23.7071 9.20711L17 15.9142V22.5C17 22.7761 16.7761 23 16.5 23H11.5C11.2239 23 11 22.7761 11 22.5V15.9142L4.29289 9.20711C4.10536 9.01957 4 8.76522 4 8.5V6.5Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill={filterIconFilled ? '#FFFFFF' : 'none'} />
            </svg>
          </button>
          {/* loading indicator removed to avoid header text flicker */}
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
            <button
              className="px-2 py-1 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn"
              style={{ minWidth: '90px', fontSize:11, fontWeight:'normal', borderWidth: '1px', borderStyle: 'solid' }}
              onClick={() => {
                if (!filterVal) return;
                setFilters(f => [...f, { col: filterCol, op: filterOp, val: filterVal }]);
                setFilterVal('');
              }}
            >
              Add Filter
            </button>
          </div>
          <div className="mb-2">
            <span style={{fontSize:11, fontWeight:'normal', fontFamily:'Segoe UI', color:'#fff'}}>Current Filters:</span>
            <ul className="bg-[#102236] rounded p-2 mt-1" style={{ minHeight: 40 }}>
              {filters.map((f, i) => (
                <li key={i} className="text-white flex items-center gap-2 mb-1 filter-panel-label" style={{fontSize:11, fontWeight:'normal'}}>
                  <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal'}}>{f.col} {f.op} {f.val}</span>
                  <button className="px-2 py-0.5 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{fontSize:11, fontWeight:'normal', borderWidth: '1px', borderStyle: 'solid'}} onClick={() => setFilters(fs => fs.filter((_, idx) => idx !== i))}>Remove</button>
                </li>
              ))}
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
            <button className="px-3 py-1 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{ minWidth: '90px', fontSize:11, fontWeight:'normal', borderWidth: '1px', borderStyle: 'solid' }} onClick={() => setFilterPanelOpen(false)}>Apply</button>
            <button className="px-3 py-1 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{ minWidth: '90px', fontSize:11, fontWeight:'normal', borderWidth: '1px', borderStyle: 'solid' }} onClick={() => setFilters([])}>Clear All</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500" style={{ paddingBottom: 12 }}>
        <table className="w-full text-sm table-mono">
          <thead className="sticky top-0 bg-[#1A334C] z-10">
            <tr className="text-gray-300">
              {columns.map(col => (
                <th
                  key={col.key}
                  className="py-1 px-2 text-center border-r border-gray-600 cursor-pointer select-none"
                  onClick={() => handleSort(col.key)}
                  style={{
                    userSelect: 'none',
                    position: 'relative',
                    whiteSpace: 'nowrap',
                    fontFamily: TABLE_HEADER_FONT,
                    fontSize: TABLE_HEADER_FONT_SIZE,
                    color: TABLE_HEADER_COLOR,
                    fontWeight: TABLE_HEADER_FONT_WEIGHT,
                  }}
                >
                  {col.label}
                  {sortColumn === col.key && (
                    <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#aaa', pointerEvents: 'none' }}>
                      {sortDirection === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr key={idx} className={`border-b border-gray-700 hover:bg-[#263544]/50 h-7`} style={{ backgroundColor: idx % 2 === 0 ? '#0A1929' : '#102236' }}>
                <td className="py-1 px-2 border-r border-gray-600 text-xs text-center" style={{ fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: '#fff' }}>{withPreciousMetalUnit(row.Symbol)}</td>
                <td className="py-1 px-2 border-r border-gray-600 text-xs text-center" style={{ fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: '#fff' }}>{formatAmount(row.TotalBuyAmount)}</td>
                <td className="py-1 px-2 border-r border-gray-600 text-xs text-center" style={{ fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: '#fff' }}>{formatAmount(row.TotalSellAmount)}</td>
                <td className="py-1 px-2 border-r border-gray-600 text-xs text-center" style={{ fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: getNumericColor(row.NetAmount) }}>{formatAmount(row.NetAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
