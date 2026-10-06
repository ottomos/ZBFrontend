"use client";
import React, { useState, useEffect } from "react";
import { useVirtualizer } from '@tanstack/react-virtual';
import { getSymbolOrder } from './tableConfig';
import { formatNumberWithCommas, parseDecimalValue } from '../lib/numberFormatter';
import { usePersistedState } from '../lib/usePersistedState';
import { ThemedDropdown } from './ThemedDropdown';
import { TransactionHeaderLabel } from './TransactionHeaderLabel';

interface InternalTransactionRow {
  Symbol: string;
  Quantity: number;
  Side: string;
  'Tran Price': number;
  Timestamp: string;
  Entity?: string;
  [key: string]: string | number | undefined;
}

interface InternalTransactionsTableProps {
  rows: InternalTransactionRow[];
  title?: string;
  currentType?: string;
  onTableChange?: (tableKey: string) => void;
  onClose?: () => void;
  selectedEntity?: string;
}

const TABLE_CELL_FONT = "'Segoe UI'";
const TABLE_CELL_FONT_SIZE = "14px";
const TABLE_CELL_COLOR = "#fff";
const TABLE_HEADER_FONT = "'Segoe UI'";
const TABLE_HEADER_FONT_SIZE = "14px";
const TABLE_HEADER_COLOR = "#fff";
const TABLE_HEADER_FONT_WEIGHT = "bold";
const TRANSACTION_ROW_HEIGHT = 28;
const TRANSACTION_ROW_OVERSCAN = 10;

export function InternalTransactionsTable({ title = 'Internal Transactions', rows, currentType = 'internal', onTableChange, onClose, selectedEntity = 'KFH' }: InternalTransactionsTableProps) {
  const symbolOrder = React.useMemo(() => getSymbolOrder(selectedEntity), [selectedEntity]);
  const [searchTerm, setSearchTerm] = usePersistedState('ui.search.transactions.internal', '');
  const [sortColumn, setSortColumn] = useState<string | null>('Timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = usePersistedState<Array<{ col: string; op: string; val: string }>>('ui.filters.transactions.internal', []);
  const hasActiveFilters = filters.length > 0;
  const [filterCol, setFilterCol] = useState('Symbol');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterVal, setFilterVal] = useState('');
  const [filterLogic, setFilterLogic] = usePersistedState<'AND' | 'OR'>('ui.filters.transactions.internal.logic', 'AND');

  // Filtering logic
  function filterRow(row: InternalTransactionRow) {
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

  // Filter rows based on search term and filter panel
  const filteredRows = rows.filter(row =>
    (row.Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(row.Side).toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(row.Entity ?? '').toLowerCase().includes(searchTerm.toLowerCase())) &&
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

  function getSortedRows(rows: InternalTransactionRow[]) {
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn as keyof InternalTransactionRow];
      const bVal = b[sortColumn as keyof InternalTransactionRow];
      // Special handling for Timestamp column
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
      if (sortColumn === 'Symbol') {
        const aIdx = symbolOrder.indexOf(String(aVal));
        const bIdx = symbolOrder.indexOf(String(bVal));
        if (aIdx !== -1 && bIdx !== -1) return sortDirection === 'asc' ? aIdx - bIdx : bIdx - aIdx;
        if (aIdx !== -1) return sortDirection === 'asc' ? -1 : 1;
        if (bIdx !== -1) return sortDirection === 'asc' ? 1 : -1;
        return sortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }
      // Try to parse as number for other columns
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
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => TRANSACTION_ROW_HEIGHT,
    overscan: TRANSACTION_ROW_OVERSCAN,
    // At the top, let prepended live rows become visible immediately. Once the
    // user scrolls, preserve the record they are reading as rows arrive.
    anchorTo: isAtTop ? 'start' : 'end',
    getItemKey: (index) => {
      const row = sortedRows[index];
      return String(row?.Timestamp ?? index);
    },
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows.at(-1)!.end
    : 0;

  function getSideTextColor(side?: string) {
    if (!side) return TABLE_CELL_COLOR;
    const normalized = String(side).toLowerCase();
    if (normalized.includes('buy')) return '#2ECC71';
    if (normalized.includes('sell')) return '#FF4757';
    return TABLE_CELL_COLOR;
  }

  // Stable zebra stripe: base it on the row's timestamp rather than the list
  // index. The live feed prepends rows (rolling window), which shifts every
  // index each poll and would otherwise flip a row's color back and forth.
  function getRowStripeColor(row: InternalTransactionRow, fallbackIdx: number): string {
    const ts = new Date(String(row.Timestamp).replace(' ', 'T')).getTime();
    if (isNaN(ts)) return fallbackIdx % 2 === 0 ? '#0A1929' : '#102236';
    return Math.floor(ts / 1000) % 2 === 0 ? '#0A1929' : '#102236';
  }

  // Only display columns we care about
  const columns = [
    { key: 'Symbol', label: 'Symbol', align: 'center' },
    { key: 'Quantity', label: 'Quantity', align: 'center' },
    { key: 'Side', label: 'Side', align: 'center' },
    { key: 'Tran Price', label: 'Tran Price', align: 'center' },
    { key: 'Timestamp', label: 'Timestamp', align: 'center' },
    { key: 'Entity', label: 'Entity', align: 'center' }
  ];

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

  function formatQuantity(value?: number | string) {
    const parsed = parseDecimalValue(value);
    if (isNaN(parsed)) return '';
    return formatNumberWithCommas(parsed);
  }

  function formatPrice(symbol: string | undefined, value?: number | string) {
    const decimals = symbol && String(symbol).startsWith('X') ? 3 : 5;
    const parsed = parseDecimalValue(value);
    if (isNaN(parsed)) {
      return (0).toFixed(decimals);
    }
    return parsed.toFixed(decimals);
  }

  return (
    <div className="transaction-blue-table bg-[#102236] p-2 h-full flex flex-col" style={{ boxSizing: 'border-box', paddingBottom: 12 }}>
      <div className="table-header-controls flex items-center justify-between mb-3" style={{ marginTop: 6 }}>
        <div className="table-header-controls-inner flex items-center w-full">
          <div className="table-header-control relative flex items-center pl-4">
            <ThemedDropdown
              value={currentType}
              onChange={(value) => onTableChange?.(value)}
              disabled={!onTableChange}
              width={260}
              options={[
                { value: 'customer', label: <TransactionHeaderLabel type="customer" /> },
                { value: 'internal', label: <TransactionHeaderLabel type="internal" /> },
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
          {/* Filter Icon */}
          <button
            className="table-header-icon-btn ml-auto mr-4 flex items-center justify-center bg-transparent border-none p-0"
            onClick={() => setFilterPanelOpen(v => !v)}
            title="Toggle Filter Panel"
            style={{ background: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 28 28" fill={hasActiveFilters ? '#FFFFFF' : 'none'} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
              <path d="M4 6.5C4 5.94772 4.44772 5.5 5 5.5H23C23.5523 5.5 24 5.94772 24 6.5V8.5C24 8.76522 23.8946 9.01957 23.7071 9.20711L17 15.9142V22.5C17 22.7761 16.7761 23 16.5 23H11.5C11.2239 23 11 22.7761 11 22.5V15.9142L4.29289 9.20711C4.10536 9.01957 4 8.76522 4 8.5V6.5Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill={hasActiveFilters ? '#FFFFFF' : 'none'} />
            </svg>
          </button>
        </div>
      </div>
      {/* Filter Panel UI */}
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
      <div
        ref={scrollContainerRef}
        onScroll={(event) => setIsAtTop(event.currentTarget.scrollTop <= 1)}
        className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500"
        style={{ paddingBottom: 12 }}
        data-total-rows={sortedRows.length}
        data-rendered-rows={virtualRows.length}
      >
        <table className="w-full text-sm table-mono" aria-rowcount={sortedRows.length + 1}>
          <thead className="sticky top-0 bg-[#1A334C] z-10">
            <tr className="text-gray-300">
              {columns.map(col => (
                <th
                  key={col.key}
                  className="py-1 px-2 text-center border-r border-[#22456b] cursor-pointer select-none"
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
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={columns.length} style={{ height: paddingTop, padding: 0, border: 0 }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const idx = virtualRow.index;
              const row = sortedRows[idx];
              return (
              <tr key={virtualRow.key} className="border-b border-[#22456b] hover:bg-[#1A334C]/50 h-7" style={{ backgroundColor: getRowStripeColor(row, idx) }}>
                  {columns.map(col => {
                    let cellValue = row[col.key];
                    if (col.key === 'Timestamp') {
                      cellValue = formatTimestamp(cellValue);
                    }
                    if (col.key === 'Quantity') {
                      cellValue = formatQuantity(cellValue);
                    }
                    if (col.key === 'Tran Price') {
                      cellValue = formatPrice(row.Symbol, cellValue);
                    }
                    let cellColor = '#fff';
                  if (['Symbol', 'Quantity', 'Side', 'Tran Price'].includes(col.key)) {
                    cellColor = getSideTextColor(String(row.Side));
                  }
                  return (
                    <td key={col.key} className="py-1 px-2 border-r border-[#22456b] text-xs text-center" style={{ fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, fontWeight: 'normal', color: cellColor }}>{cellValue}</td>
                  );
                })}
              </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={columns.length} style={{ height: paddingBottom, padding: 0, border: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
