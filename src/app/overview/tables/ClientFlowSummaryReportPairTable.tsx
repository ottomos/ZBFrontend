"use client";
import React, { useState } from "react";
import { formatNumberWithCommas, parseDecimalValue, withPreciousMetalUnit } from "../../lib/numberFormatter";
import { usePersistedState } from "../../lib/usePersistedState";
import { ThemedDropdown } from "../../components/ThemedDropdown";
import { OverviewTableHeaderLabel } from "../../components/OverviewTableHeaderLabel";

interface ClientFlowRow {
  Symbol: string;
  TotalAmount: number;
  ClientBuyAmount: number;
  ClientSellAmount: number;
  NetAmount: number;
  SalesPnL: number;
  Timestamp?: string;
  Entity?: string;
  [key: string]: string | number | undefined;
}

interface ClientFlowSummaryReportPairTableProps {
  rows: ClientFlowRow[];
  title?: string;
  currentType?: string;
  onTableChange?: (tableKey: string) => void;
  onClose?: () => void;
  profile?: string;
}

const TABLE_CELL_FONT = "'Segoe UI'";
const TABLE_CELL_FONT_SIZE = "14px";
const TABLE_CELL_COLOR = "#fff";
const TABLE_HEADER_FONT = "'Segoe UI'";
const TABLE_HEADER_FONT_SIZE = "14px";
const TABLE_HEADER_COLOR = "#fff";
const TABLE_HEADER_FONT_WEIGHT = "bold";
const TOTAL_ROW_LABEL = 'TOTAL ($)';

function isTotalSummaryRow(row: ClientFlowRow) {
  const symbol = String(row.Symbol ?? '').trim();
  return /^total\b/i.test(symbol);
}

export function ClientFlowSummaryReportPairTable({
  title = "ClientFlowSummaryReport_pair table",
  rows,
  currentType = "internal",
  onTableChange,
  onClose,
  profile = 'KFH',
}: ClientFlowSummaryReportPairTableProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = usePersistedState<string>('ui.search.overview.client-flow-pair', '');
  const [sortColumn, setSortColumn] = useState<string | null>("TotalAmount");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [filters, setFilters] = usePersistedState<Array<{ col: string; op: string; val: string }>>('ui.filters.overview.client-flow-pair', []);
  const [filterCol, setFilterCol] = useState('Symbol');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterVal, setFilterVal] = useState('');
  const [filterLogic, setFilterLogic] = usePersistedState<'AND' | 'OR'>('ui.filters.overview.client-flow-pair.logic', 'AND');
  const [filterIconHydrated, setFilterIconHydrated] = useState(false);
  const totalRow = React.useMemo(() => rows.find(isTotalSummaryRow), [rows]);
  const visibleRows = React.useMemo(() => rows.filter((row) => !isTotalSummaryRow(row)), [rows]);
  const footerRow = React.useMemo<ClientFlowRow>(() => ({
    Symbol: TOTAL_ROW_LABEL,
    TotalAmount: totalRow?.TotalAmount as number,
    ClientBuyAmount: totalRow?.ClientBuyAmount as number,
    ClientSellAmount: totalRow?.ClientSellAmount as number,
    NetAmount: totalRow?.NetAmount as number,
    SalesPnL: totalRow?.SalesPnL as number,
  }), [totalRow]);

  React.useEffect(() => {
    setFilterIconHydrated(true);
  }, []);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateScrollbarWidth = () => {
      const nextWidth = Math.max(container.offsetWidth - container.clientWidth, 0);
      setScrollbarWidth(nextWidth);
    };

    updateScrollbarWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollbarWidth();
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', updateScrollbarWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollbarWidth);
    };
  }, [rows.length, filterPanelOpen, searchTerm, filters.length, sortColumn, sortDirection]);

  function filterRow(row: ClientFlowRow) {
    if (filters.length === 0) return true;
    const results = filters.map(f => {
      const cell = String(row[f.col] ?? '');
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

  const filteredRows = visibleRows.filter(row =>
    String(row.Symbol).toLowerCase().includes(searchTerm.toLowerCase()) &&
    filterRow(row)
  );

  function handleSort(col: string) {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  }

  function getSortedRows(rows: ClientFlowRow[]) {
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn as keyof ClientFlowRow];
      const bVal = b[sortColumn as keyof ClientFlowRow];
      if (sortColumn === 'Timestamp') {
        const aTime = new Date(String(aVal)).getTime();
        const bTime = new Date(String(bVal)).getTime();
        if (!isNaN(aTime) && !isNaN(bTime)) {
          return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
        }
        return sortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/[^0-9.-]+/g, ''));
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }

  const sortedRows = getSortedRows(filteredRows);
  const hasActiveFilters = filters.length > 0;
  const filterIconFilled = filterIconHydrated && hasActiveFilters;

  function getSideTextColor(side?: string) {
    if (!side) return TABLE_CELL_COLOR;
    const normalized = String(side).toLowerCase();
    if (normalized.includes('buy')) return '#2ECC71';
    if (normalized.includes('sell')) return '#FF4757';
    return TABLE_CELL_COLOR;
  }

  function getNumericColor(value?: number | string) {
    const parsed = parseDecimalValue(value as any);
    if (isNaN(parsed)) return TABLE_CELL_COLOR;
    if (parsed > 0) return '#2ECC71';
    if (parsed < 0) return '#FF4757';
    return TABLE_CELL_COLOR;
  }

  const columns = [
    { key: 'Symbol', label: 'Symbol', align: 'center', width: '11%' },
    { key: 'TotalAmount', label: 'Total Amount', align: 'center', width: '17.8%' },
    { key: 'ClientBuyAmount', label: 'Client Buy Amount', align: 'center', width: '17.8%' },
    { key: 'ClientSellAmount', label: 'Client Sell Amount', align: 'center', width: '17.8%' },
    { key: 'NetAmount', label: 'Net Amount', align: 'center', width: '17.8%' },
    { key: 'SalesPnL', label: 'Sales PnL', align: 'center', width: '17.8%' }
  ];

  function renderCellValue(row: ClientFlowRow, key: string, isFooter = false) {
    if (key === 'Symbol') {
      return isFooter ? TOTAL_ROW_LABEL : withPreciousMetalUnit(String(row[key] ?? '-'));
    }

    if (isFooter && key === 'NetAmount') {
      return '';
    }

    if (['TotalAmount', 'ClientBuyAmount', 'ClientSellAmount', 'NetAmount', 'SalesPnL'].includes(key)) {
      const value = row[key];
      if (value === undefined || value === null || value === '') {
        return '-';
      }
      const formatted = formatAmount(value);
      return formatted || '-';
    }

    return String(row[key] ?? '-');
  }

  function formatTimestamp(ts?: string | number) {
    if (ts === undefined || ts === null) return '';
    const str = String(ts);
    const match = str.match(/^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})(\.(\d+))?(?:\s*[+-]\d{2}:?\d{2})?$/);
    if (match) {
      const base = match[1];
      let ms = match[3] || '000';
      ms = ms.padEnd(3, '0').slice(0, 3);
      return `${base}.${ms}`;
    }
    return str;
  }

  function formatAmount(value?: number | string) {
    const parsed = parseDecimalValue(value);
    if (isNaN(parsed)) return '';
    return formatNumberWithCommas(parsed);
  }

  return (
    <div className="overview-blue-table bg-[#102236] p-2 h-full flex flex-col" style={{ boxSizing: 'border-box', paddingBottom: 12 }}>
      <div className="table-header-controls flex items-center justify-between mb-3" style={{ marginTop: 6 }}>
        <div className="table-header-controls-inner flex items-center w-full">
          <div className="table-header-control relative flex items-center pl-4">
            <ThemedDropdown
              value={title?.includes('currency') ? 'client-flow-currency' : 'client-flow-pair'}
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
            className="table-header-icon-btn ml-auto mr-4 flex items-center justify-center bg-transparent border-none p-0"
            onClick={() => setFilterPanelOpen(v => !v)}
            title={filterPanelOpen ? 'Hide Filter Panel' : 'Show Filter Panel'}
            style={{ cursor: 'pointer', background: 'none' }}
          >
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
      <div ref={scrollContainerRef} className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
        <table className="w-full text-sm table-mono table-fixed">
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
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
            {sortedRows.map((row, idx) => (
              <tr key={`${row.Symbol}-${idx}`} className={`border-b border-gray-700 hover:bg-[#263544]/50 h-7`} style={{ backgroundColor: idx % 2 === 0 ? '#0A1929' : '#102236' }}>
                {columns.map(col => {
                  const cellValue = renderCellValue(row, col.key);
                  let cellColor = '#fff';
                  if (col.key === 'Symbol') {
                    cellColor = '#fff';
                  }
                  if (col.key === 'NetAmount' || col.key === 'SalesPnL') {
                    cellColor = getNumericColor(row[col.key] as any);
                  }
                  return (
                    <td key={col.key} className="py-1 px-2 border-r border-gray-600 text-xs text-center" style={{ fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, fontWeight: 'normal', color: cellColor }}>{cellValue}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="bg-[#102133]"
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.35)',
          paddingRight: scrollbarWidth > 0 ? `${scrollbarWidth}px` : 0,
          boxSizing: 'border-box',
        }}
      >
        <table className="w-full text-sm table-mono table-fixed">
          <colgroup>
            {columns.map((col) => (
              <col key={`footer-${col.key}`} style={{ width: col.width }} />
            ))}
          </colgroup>
          <tfoot>
            <tr className="h-7" style={{ backgroundColor: '#102133', fontWeight: 'bold' }}>
              {columns.map((col) => {
                const cellValue = renderCellValue(footerRow, col.key, true);
                const cellColor = (col.key === 'NetAmount' || col.key === 'SalesPnL') && totalRow
                  ? getNumericColor(footerRow[col.key] as any)
                  : '#fff';

                return (
                  <td
                    key={`total-${col.key}`}
                    className="py-1 px-2 border-r border-gray-600 text-xs text-center"
                    style={{
                      fontFamily: TABLE_CELL_FONT,
                      fontSize: TABLE_CELL_FONT_SIZE,
                      fontWeight: 700,
                      color: cellColor,
                      backgroundColor: '#102133',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{cellValue}</span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}