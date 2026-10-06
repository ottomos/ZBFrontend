'use client';

import React, { useState } from 'react';
import { getSymbolOrder, TABLE_HEADER_ROW_HEIGHT, TABLE_HEADER_CONTENT_HEIGHT, TABLE_BODY_ROW_HEIGHT, TABLE_BODY_CONTENT_HEIGHT } from './tableConfig';
import { AutoReduceWrappedText } from './AutoReduceWrappedText';
import { formatNumberWithCommas } from '../lib/numberFormatter';
import { User, canUserTrade } from '../types/user';
import { usePersistedState } from '../lib/usePersistedState';
import { ThemedDropdown } from './ThemedDropdown';
import { TradeHeaderLabel } from './TradeHeaderLabel';

interface ExecutionRow {
  Symbol: string;
  Quantity: number;
  Price: number;
  Side: 'Buy' | 'Sell';
  Venue: string;
  'Counter Party': string;
  Timestamp: string;
  Strategy: string;
  'Realized PnL': number;
  [key: string]: string | number; // <-- Add index signature for dynamic access
}

interface ExecutionTableProps {
  title: string;
  rows: ExecutionRow[];
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
const TABLE_HEADER_FONT_WEIGHT = "bold";  // "normal" "bold" veya sayi: 600 gibi

export function ExecutionTable({ title, rows, currentType = 'execution', onTableChange, onClose, selectedEntity = 'KFH' }: ExecutionTableProps) {
  const symbolOrder = React.useMemo(() => getSymbolOrder(selectedEntity), [selectedEntity]);
    // Get color for Buy/Sell
    function getBuySellColor(side: string) {
      if (side === 'Buy') return 'trade-positive-text';
      if (side === 'Sell') return 'trade-critical-text';
      return 'text-white'; // neutral
    }
  const [searchTerm, setSearchTerm] = usePersistedState<string>('ui.search.dashboard.execution', '');
  const [executions, setExecutions] = useState<ExecutionRow[]>(rows);
  const [sortColumn, setSortColumn] = useState<string | null>('Timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Update executions when rows prop changes
  React.useEffect(() => {
    setExecutions(rows);
  }, [rows]);

  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = usePersistedState<Array<{ col: string; op: string; val: string }>>('ui.filters.dashboard.execution', []);
  const [filterCol, setFilterCol] = useState('Symbol');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterVal, setFilterVal] = useState('');
  const [filterLogic, setFilterLogic] = usePersistedState<'AND' | 'OR'>('ui.filters.dashboard.execution.logic', 'AND');
  const [canTrade, setCanTrade] = useState(false);
  const fixedHeaderLabel = React.useMemo(() => {
    if (currentType === 'position') return <TradeHeaderLabel type="position" />;
    if (currentType === 'execution') return <TradeHeaderLabel type="execution" />;
    if (currentType === 'risk') return <TradeHeaderLabel type="risk" />;
    return currentType;
  }, [currentType]);

  React.useEffect(() => {
    const userDataStr = localStorage.getItem('user');
    if (userDataStr) {
      try {
        const userData: User = JSON.parse(userDataStr);
        setCanTrade(canUserTrade(userData, selectedEntity));
      } catch (error) {
        setCanTrade(false);
      }
    } else {
      setCanTrade(false);
    }
  }, [selectedEntity]);

  // Filtering logic
  function filterRow(row: ExecutionRow) {
    if (filters.length === 0) return true;
    const results = filters.map(f => {
      const cell = String(row[f.col] ?? '');
      const val = f.val;
      switch (f.op) {
        case 'contains':
          return cell.toLowerCase().includes(val.toLowerCase());
        case 'does not contain':
          return !cell.toLowerCase().includes(val.toLowerCase());
        case 'equals':
          return cell.toLowerCase() === val.toLowerCase();
        case 'does not equal':
          return cell.toLowerCase() !== val.toLowerCase();
        case '>': {
          const numCell = parseFloat(cell.replace(/[^0-9eE+.-]+/g, ''));
          const numVal = parseFloat(val);
          return numCell > numVal;
        }
        case '<': {
          const numCell = parseFloat(cell.replace(/[^0-9eE+.-]+/g, ''));
          const numVal = parseFloat(val);
          return numCell < numVal;
        }
        default:
          return true;
      }
    });
    if (filterLogic === 'AND') {
      return results.every(Boolean);
    } else {
      return results.some(Boolean);
    }
  }

  // Filter executions based on search term and filter panel
  const filteredExecutions = executions.filter(execution =>
    (execution.Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatSide(execution.Side).toLowerCase().includes(searchTerm.toLowerCase()) ||
      execution.Venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      execution['Counter Party'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      execution.Strategy.toLowerCase().includes(searchTerm.toLowerCase())) &&
    filterRow(execution)
  );

  function handleSort(col: string) {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  }

  function getSortedRows(rows: ExecutionRow[]) {
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn as keyof ExecutionRow];
      const bVal = b[sortColumn as keyof ExecutionRow];
      
      // Special handling for Symbol column
      if (sortColumn === 'Symbol') {
        const aIndex = symbolOrder.indexOf(String(aVal));
        const bIndex = symbolOrder.indexOf(String(bVal));
        
        // If both symbols are in the custom order, use that order
        if (aIndex !== -1 && bIndex !== -1) {
          return sortDirection === 'asc' ? aIndex - bIndex : bIndex - aIndex;
        }
        // If only one is in the custom order, prioritize it
        if (aIndex !== -1 && bIndex === -1) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (aIndex === -1 && bIndex !== -1) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        // If neither is in the custom order, fall back to alphabetical
        return sortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }
      
      // Special handling for Timestamp column
      if (sortColumn === 'Timestamp') {
        const aTime = new Date(String(aVal)).getTime();
        const bTime = new Date(String(bVal)).getTime();
        
        // If both are valid dates, sort by time
        if (!isNaN(aTime) && !isNaN(bTime)) {
          return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
        }
        
        // If not valid dates, try to parse as time strings (HH:MM:SS format)
        const timeRegex = /(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/;
        const aMatch = String(aVal).match(timeRegex);
        const bMatch = String(bVal).match(timeRegex);
        
        if (aMatch && bMatch) {
          const aSeconds = parseInt(aMatch[1]) * 3600 + parseInt(aMatch[2]) * 60 + parseInt(aMatch[3]) + (aMatch[4] ? parseInt(aMatch[4]) / 1000000 : 0);
          const bSeconds = parseInt(bMatch[1]) * 3600 + parseInt(bMatch[2]) * 60 + parseInt(bMatch[3]) + (bMatch[4] ? parseInt(bMatch[4]) / 1000000 : 0);
          return sortDirection === 'asc' ? aSeconds - bSeconds : bSeconds - aSeconds;
        }
        
        // Fallback to string comparison for timestamps
        return sortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }
      
      // Try to parse as number for other columns
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/[^0-9eE+.-]+/g, ''));
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/[^0-9eE+.-]+/g, ''));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      // Fallback to string compare for other columns
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }

  const sortedRows = getSortedRows(filteredExecutions);
  const hasActiveFilters = filters.length > 0;
  const headerCellStyle: React.CSSProperties = {
    height: `${TABLE_HEADER_ROW_HEIGHT}px`,
    boxSizing: 'border-box',
    verticalAlign: 'middle',
    lineHeight: 1.1,
  };
  const bodyCellStyle: React.CSSProperties = {
    minHeight: `${TABLE_BODY_ROW_HEIGHT}px`,
    boxSizing: 'border-box',
    paddingTop: '2px',
    paddingBottom: '2px',
    verticalAlign: 'middle',
  };
  const renderHeaderLabel = (label: string) => (
    <span className="flex w-full items-center justify-center text-center leading-tight" style={{ height: `${TABLE_HEADER_CONTENT_HEIGHT}px` }}>
      {label.split('\n').map((line, i, arr) => (
        <React.Fragment key={`${label}-${line}-${i}`}>
          {line}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );

  // Only display columns we care about, ignore any extra fields (like email)
  const columns = [
    { key: 'Symbol', label: 'Symbol', align: 'center' },
    { key: 'Quantity', label: 'Quantity', align: 'center' },
    { key: 'Price', label: 'Price', align: 'center' },
    { key: 'Side', label: 'Side', align: 'center' },
    { key: 'Venue', label: 'Venue', align: 'center' },
    { key: 'Counter Party', label: 'Counter\nParty', align: 'center' },
    { key: 'Timestamp', label: 'Timestamp', align: 'center' },
    { key: 'Strategy', label: 'Strategy', align: 'center' },
    { key: 'Realized PnL', label: 'Realized PnL', align: 'center' }
  ];

  // If rows have extra fields (like email), ignore them in rendering
  // (No change needed in rendering, as only columns above are rendered)

  function colorNumber(val: number) {
    if (val > 0) return 'trade-positive-text';
    if (val < 0) return 'trade-critical-text';
    return 'text-white'; // White for zero/neutral
  }

  function getSideTextColor(side: string) {
    return side === 'Buy' ? 'trade-positive-text' : 'trade-critical-text';
  }

  // Convert numeric side to text
  function formatSide(side: string | number) {
    if (side === '1' || side === 1) return 'Buy';
    if (side === '2' || side === 2) return 'Sell';
    return String(side); // fallback for existing text values
  }

  // Format timestamp to 'YYYY-MM-DD HH:mm:ss' (single line, no wrapping)
  function formatTimestamp(ts: string) {
    // Match 'YYYY-MM-DD HH:mm:ss.sss' or 'YYYY-MM-DD HH:mm:ss'
    const match = ts.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(\.(\d+))?/);
    if (match) {
      const base = match[1];
      let ms = match[3] || "000";
      // Ensure ms is 3 digits
      ms = ms.padEnd(3, "0").slice(0, 3);
      return `${base}.${ms}`;
    }
    return ts;
  }

  return (
    <div className="execution-table trade-blue-table bg-[#102236] p-2 h-full flex flex-col">
      <style>{`
        .filter-panel-btn {
          transition: filter 0.15s;
        }
        .filter-panel-btn:hover {
          filter: brightness(1.25);
        }
      `}</style>
      <div className="table-header-controls flex items-center justify-between mb-3" style={{ marginTop: 6 }}>
        <div className="table-header-controls-inner flex items-center w-full">
          <div className="table-header-control relative flex items-center pl-4">
            {['position','execution','risk'].includes(currentType || '') ? (
              <div className="custom-dropdown" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center' }}>
                {fixedHeaderLabel}
              </div>
            ) : (
              <ThemedDropdown
                value={currentType}
                onChange={(value) => onTableChange?.(value)}
                width={140}
                options={[
                  { value: 'strategy', label: <TradeHeaderLabel type="strategy" /> },
                  ...(canTrade ? [{ value: 'manual-trade', label: 'Manual Trade' }] : []),
                ]}
              />
            )}

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
          {/* Filter panel toggle: filter icon */}
          <button
            className="table-header-icon-btn ml-auto mr-4 flex items-center justify-center bg-transparent border-none p-0"
            onClick={() => setFilterPanelOpen(v => !v)}
            style={{ cursor: 'pointer', background: 'none' }}
            title={filterPanelOpen ? 'Hide Filter Panel' : 'Show Filter Panel'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 28 28"
              fill={hasActiveFilters ? '#FFFFFF' : 'none'}
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block' }}
            >
              <path
                d="M4 6.5C4 5.94772 4.44772 5.5 5 5.5H23C23.5523 5.5 24 5.94772 24 6.5V8.5C24 8.76522 23.8946 9.01957 23.7071 9.20711L17 15.9142V22.5C17 22.7761 16.7761 23 16.5 23H11.5C11.2239 23 11 22.7761 11 22.5V15.9142L4.29289 9.20711C4.10536 9.01957 4 8.76522 4 8.5V6.5Z"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinejoin="round"
                fill={hasActiveFilters ? '#FFFFFF' : 'none'}
              />
            </svg>
          </button>
          {/* close button removed per design */}
        </div>
      </div>
      <style>{`
        .table-mono td, .table-mono th {
          font-family: 'Segoe UI';
          font-size: 14px;
          font-variant-ligatures: none;
          font-feature-settings: 'liga' 0;
        }
      `}</style>
      {/* Filter panel UI */}
      {filterPanelOpen && (
        <div className="trade-filter-panel bg-[#1A334C] rounded-lg p-3 mb-4 flex flex-col gap-2 w-full" style={{ width: '100%' }}>
          <div className="flex gap-2 items-center mb-2">
            <span className="filter-panel-select-xs" style={{fontSize:11, fontWeight:'normal', color:'#fff'}}>Col:</span>
            <ThemedDropdown
              value={filterCol}
              onChange={setFilterCol}
              minWidth={140}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={columns.map(col => ({ value: col.key, label: col.label.replace(/\n/g, ' ') }))}
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
      <div className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
        <table className="w-full text-sm table-mono">
          <thead className="sticky top-0 bg-[#1A334C] z-10">
            <tr className="text-gray-300">
              {columns.map(col => (
                <th
                  key={col.key}
                  className="py-1 px-2 text-center border-r border-gray-600 cursor-pointer select-none"
                  onClick={() => handleSort(col.key)}
                  style={{
                    ...headerCellStyle,
                    userSelect: 'none',
                    position: 'relative',
                    whiteSpace: 'nowrap',
                    fontFamily: TABLE_HEADER_FONT,
                    fontSize: TABLE_HEADER_FONT_SIZE,
                    color: TABLE_HEADER_COLOR,
                    fontWeight: TABLE_HEADER_FONT_WEIGHT,
                    width:
                      col.key === 'Quantity' ? '113px' :
                      col.key === 'Price' ? '72px' :
                      col.key === 'Counter Party' ? '105px' : // 70px * 1.5
                      col.key === 'Strategy' ? '48px' : // 60px * 0.8
                      col.key === 'Side' ? '60px' :
                      col.key === 'Timestamp' ? '120px' :
                      col.key === 'Symbol' ? '80px' :
                      col.key === 'Venue' ? '75px' :
                      col.key === 'Realized PnL' ? '100px' :
                      'auto',
                    minWidth:
                      col.key === 'Quantity' ? '113px' :
                      col.key === 'Price' ? '72px' :
                      col.key === 'Counter Party' ? '105px' :
                      col.key === 'Strategy' ? '48px' :
                      col.key === 'Side' ? '60px' :
                      col.key === 'Timestamp' ? '120px' :
                      col.key === 'Symbol' ? '80px' :
                      col.key === 'Venue' ? '75px' :
                      col.key === 'Realized PnL' ? '100px' :
                      'auto',
                  }}
                >
                  {renderHeaderLabel(col.label)}
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
            {sortedRows.map((row, i) => (
              <tr key={`${row.Symbol}-${row.Timestamp}-${row.Quantity}-${i}`} className="border-b border-gray-700 hover:bg-[#1A334C]/50" style={{ 
                minHeight: `${TABLE_BODY_ROW_HEIGHT}px`,
                backgroundColor: i % 2 === 0 ? '#0A1929' : '#102236'
              }}>
                <td className="py-1 px-2 border-r border-gray-600 text-xs text-center" style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, fontWeight: 'normal', width: '80px', minWidth: '80px' }}><span className="flex h-full items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{row.Symbol}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, width: '113px', minWidth: '113px', whiteSpace: 'nowrap' }} className="py-1 px-2 font-mono border-r border-gray-600 text-center"><span className="flex h-full items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatNumberWithCommas(Math.round(row.Quantity || 0))}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, width: '72px', minWidth: '72px' }} className="py-1 px-2 font-mono border-r border-gray-600 text-center">
                  <span className="flex h-full items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>
                    {String(row.Symbol).startsWith('X')
                      ? (row.Price || 0).toFixed(3)
                      : (row.Price || 0).toFixed(5)}
                  </span>
                </td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '60px', minWidth: '60px' }} className={`py-1 px-2 border-r border-gray-600 text-center ${getBuySellColor(formatSide(row.Side))}`}><span className="flex h-full items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatSide(row.Side)}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, width: '75px', minWidth: '75px' }} className="py-1 px-2 text-gray-300 border-r border-gray-600 text-center"><span className="flex h-full items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{row.Venue}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, width: '105px', minWidth: '105px', height: `${TABLE_BODY_ROW_HEIGHT}px`, overflow: 'hidden' }} className="py-1 px-2 text-gray-300 border-r border-gray-600 text-center"><AutoReduceWrappedText text={String(row['Counter Party'] ?? '')} baseFontSize={TABLE_CELL_FONT_SIZE} reducedFontSize="9px" containerHeight={`${TABLE_BODY_CONTENT_HEIGHT}px`} normalMinHeight={`${TABLE_BODY_CONTENT_HEIGHT}px`} wrappedMinHeight={`${TABLE_BODY_CONTENT_HEIGHT}px`} /></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }} className="py-1 px-2 font-mono text-gray-300 border-r border-gray-600 text-center"><span className="flex h-full items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatTimestamp(row.Timestamp)}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, width: '48px', minWidth: '48px' }} className="py-1 px-2 text-gray-300 border-r border-gray-600 text-center"><span className="flex h-full items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{row.Strategy}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100px', minWidth: '100px' }} className={`py-1 px-2 font-mono border-r border-gray-600 text-center ${colorNumber(row['Realized PnL'])}`}><span className="flex h-full items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>$ {Math.round(row['Realized PnL'])}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
