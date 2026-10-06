import React, { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { getSymbolOrder, TABLE_HEADER_ROW_HEIGHT, TABLE_HEADER_CONTENT_HEIGHT, TABLE_BODY_ROW_HEIGHT, TABLE_BODY_CONTENT_HEIGHT } from "./tableConfig";
import { User, canUserTrade } from "../types/user";
import { useConfig } from "../context/ConfigContext";
import { formatNumberWithCommas, formatCurrency } from "../lib/numberFormatter";
import { usePersistedState } from "../lib/usePersistedState";
import { ThemedDropdown } from "./ThemedDropdown";
import { TradeHeaderLabel } from "./TradeHeaderLabel";
import { Power } from "lucide-react";

type Row = {
  Symbol: string;
  Position: string;
  'Position Value': string;
  'Avg Cost Rate': string;
  'Unrealized PNL': string;
  'Realized PNL': string;
  Bid: string;
  Ask: string;
  'Bid Venue': string;
  'Ask Venue': string;
  [key: string]: string; // <-- Add index signature for dynamic access
};

const COLOR_ACCENT = '#2C5680';
const COLOR_ACCENT_HOVER = '#61AAD9';
const COLOR_ACCENT_PRESSED = '#007365';
const COLOR_HEADER = '#263544';
const COLOR_CARD = '#1B2937';

// Easy font, font size, and color control for table internals
const TABLE_CELL_FONT = "'Segoe UI'";
const TABLE_CELL_FONT_SIZE = "14px";
const TABLE_CELL_COLOR = "#fff";
const TABLE_HEADER_FONT = "'Segoe UI'";
const TABLE_HEADER_FONT_SIZE = "14px";
const TABLE_HEADER_COLOR = "#fff";
const TABLE_HEADER_FONT_WEIGHT = "bold"; // "normal" "bold" veya sayi: 600 gibi

interface DataTableProps {
  title: string;
  rows: Row[];
  currentType?: string;
  onTableChange?: (tableKey: string) => void;
  onClose?: () => void;
  onCloseAllPositions?: () => void;
  selectedEntity?: string;
  currentUser?: User | null;
}

export function DataTable({ title, rows, currentType = 'position', onTableChange, onClose, onCloseAllPositions, selectedEntity = 'KFH', currentUser }: DataTableProps) {
  const config = useConfig();
  const symbolOrder = React.useMemo(() => getSymbolOrder(selectedEntity), [selectedEntity]);
  
  // Helper to format decimals based on symbol
      function formatDecimals(symbol: string, value: string) {
        const num = parseFloat(value.replace(/[^0-9eE+.-]+/g, ''));
        if (isNaN(num)) return value;
        if (/^X(AU|AG|PT)\/USD$/.test(symbol)) {
          return num.toFixed(3);
        }
        if (/^X/.test(symbol)) {
          return num.toFixed(3);
        }
        if (/\/JPY$/.test(symbol)) {
          return num.toFixed(3);
        }
        return num.toFixed(5);
      }
    // Confirmation dialog state for Close All positions
    const [confirmCloseAll, setConfirmCloseAll] = useState(false);
  const [searchTerm, setSearchTerm] = usePersistedState(`ui.search.dashboard.${currentType || 'position'}`, '');
  // Start sorted by Symbol using SYMBOL_ORDER
  const [sortColumn, setSortColumn] = useState<string>('Symbol');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hasSorted, setHasSorted] = useState(false);

  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = usePersistedState<Array<{ col: string; op: string; val: string }>>(`ui.filters.dashboard.${currentType || 'position'}`, []);
  const [filterCol, setFilterCol] = useState('Symbol');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterVal, setFilterVal] = useState('');
  const [filterLogic, setFilterLogic] = usePersistedState<'AND' | 'OR'>(`ui.filters.dashboard.${currentType || 'position'}.logic`, 'AND');

  // Authentication state for trading permissions
  const [canTrade, setCanTrade] = useState(false);

  useEffect(() => {
    // Check if user has trading permissions (Entity Admin, Entity Trader, or Group Head Trader for KFH only)
    const userDataStr = localStorage.getItem('user');
    if (userDataStr) {
      try {
        const userData: User = JSON.parse(userDataStr);
        setCanTrade(canUserTrade(userData, selectedEntity));
      } catch (error) {
        console.error('Error parsing user data:', error);
        setCanTrade(false);
      }
    } else {
      setCanTrade(false);
    }
  }, [selectedEntity]);

  function colorNumber(val: string | undefined) {
    if (typeof val !== 'string') return '';
    const num = parseFloat(val.replace(/[^0-9eE+.-]+/g, ''));
    if (isNaN(num)) return '';
    if (num > 0) return 'trade-positive-text';
    if (num < 0) return 'trade-critical-text';
    if (num === 0) return 'trade-positive-text';
    return '';
  }

  // Filtering logic
  function filterRow(row: Row) {
    if (filters.length === 0) return true;
    const results = filters.map(f => {
      const cell = row[f.col] ?? '';
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

  // Filter rows based on search term and filter panel
  const filteredRows = rows.filter(row =>
    (row.Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.Position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row['Position Value'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      row['Avg Cost Rate'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      row['Unrealized PNL'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      row['Realized PNL'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.Bid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.Ask.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row['Bid Venue'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      row['Ask Venue'].toLowerCase().includes(searchTerm.toLowerCase())) &&
    filterRow(row)
  );

  const sendKafkaMessage = async (symbol: string) => {
    const offsetHours = 0;
    const now = new Date(Date.now() + offsetHours * 3600 * 1000);
    const timestamp =
      now.toLocaleString("sv-SE", { hour12: false }).replace(",", "") +
      "." +
      now.getMilliseconds().toString().padStart(3, "0");
    const email = currentUser?.email || '';
    const csv = [symbol, 'True', 'Python', timestamp, email].join(',');
    // Use entity-specific topic
    const topic = `PanelClosePosition_${selectedEntity}`;
    try {
      await fetch(`/api/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic,
          key: symbol,
          value: csv,
          profile: selectedEntity
        })
      });
      console.log(`📤 Close position sent: ${csv} to ${topic}`);
    } catch (err) {
      console.error('Error sending close position message:', err);
    }
  };

  const closePosition = (symbol: string) => {
    sendKafkaMessage(symbol);
    console.log(`Closing position for ${symbol}`);
  };

  const closeAllPositions = () => {
    filteredRows.forEach(row => {
      sendKafkaMessage(row.Symbol);
    });
    if (onCloseAllPositions) onCloseAllPositions();
  };

  const confirmCloseAllPositions = () => {
    flushSync(() => setConfirmCloseAll(false));
    globalThis.setTimeout(closeAllPositions, 0);
  };

  function handleSort(col: string) {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
    setHasSorted(true);
  }

  function getSortedRows(rows: Row[]) {
    if (!sortColumn) return rows;
    
    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn as keyof Row];
      const bVal = b[sortColumn as keyof Row];
      
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
      
      // Try to parse as number for other columns
      const aNum = parseFloat(String(aVal).replace(/[^0-9eE+.-]+/g, ''));
      const bNum = parseFloat(String(bVal).replace(/[^0-9eE+.-]+/g, ''));
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

  const sortedRows = getSortedRows(filteredRows);
  const hasActiveFilters = filters.length > 0;
  const headerCellStyle: React.CSSProperties = {
    height: `${TABLE_HEADER_ROW_HEIGHT}px`,
    boxSizing: 'border-box',
    verticalAlign: 'middle',
    lineHeight: 1.1,
  };
  const bodyCellStyle: React.CSSProperties = {
    height: `${TABLE_BODY_ROW_HEIGHT}px`,
    boxSizing: 'border-box',
    paddingTop: '2px',
    paddingBottom: '2px',
    verticalAlign: 'middle',
  };
  const renderHeaderLabel = (label: string) => (
    <span className="flex w-full items-center justify-center text-center leading-tight" style={{ height: `${TABLE_HEADER_CONTENT_HEIGHT}px` }}>
      {label.split('\n').map((line, i) => (
        <React.Fragment key={`${label}-${line}-${i}`}>
          {line}
          {i < label.split('\n').length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );

  const columns = [
    { key: 'Symbol', label: 'Symbol' },
    { key: 'Position', label: 'Position\nBase' },
    { key: 'Position Value', label: 'Position\nValue' },
    { key: 'Avg Cost Rate', label: 'Average\nCost Rate' },
    { key: 'Unrealized PNL', label: 'Unrealized\nPNL' },
    { key: 'Realized PNL', label: 'Realized\nPNL' },
    { key: 'Bid', label: 'Bid' },
    { key: 'Ask', label: 'Ask' },
    { key: 'Bid Venue', label: 'Bid\nVenue' },
    { key: 'Ask Venue', label: 'Ask\nVenue' }
  ];

  const handleTableChange = React.useCallback((value: string) => onTableChange?.(value), [onTableChange]);
  const dropdownOptions = React.useMemo(() => [
    { value: 'strategy', label: <TradeHeaderLabel type="strategy" /> },
    ...(canTrade ? [{ value: 'manual-trade', label: 'Manual Trade' }] : []),
  ], [canTrade]);
  const fixedHeaderLabel = React.useMemo(() => {
    if (currentType === 'position') return <TradeHeaderLabel type="position" />;
    if (currentType === 'execution') return <TradeHeaderLabel type="execution" />;
    if (currentType === 'risk') return <TradeHeaderLabel type="risk" />;
    return currentType;
  }, [currentType]);

  return (
  <div className="data-table position-and-price trade-blue-table bg-[#102236] p-2 h-full flex flex-col" style={confirmCloseAll ? { position: 'relative' } : {}}>
      {/* Confirmation dialog for Close All positions, pushes everything below */}
      {confirmCloseAll && (
        <div
          className="trade-confirmation"
          style={{
            background: '#263544',
            color: 'white',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '12px',
            fontWeight: 600,
            fontSize: '15px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #2C5680',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            boxSizing: 'border-box',
            alignSelf: 'stretch',
          }}
        >
          <span style={{ flex: 1 }}>
            Are you sure you want to CLOSE ALL positions?
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="trade-primary-action"
              style={{
                background: '#2C5680',
                color: 'white',
                border: '1px solid #2C5680',
                borderRadius: '6px',
                padding: '6px 18px',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'filter 0.15s, transform 0.1s',
              }}
              onClick={confirmCloseAllPositions}
            >
              Yes
            </button>
            <button
              className="trade-secondary-action"
              style={{
                background: '#263544',
                color: 'white',
                border: '1px solid #888',
                borderRadius: '6px',
                padding: '6px 18px',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'filter 0.15s, transform 0.1s',
              }}
              onClick={() => setConfirmCloseAll(false)}
            >
              No
            </button>
          </div>
        </div>
      )}
      <style>{`
        .close-all-btn:hover:enabled {
          background-color: #61AAD9 !important;
        }
      `}</style>
      <style>{`
        .filter-panel-btn {
          transition: filter 0.15s, transform 0.1s;
        }
        .filter-panel-btn:hover {
          filter: brightness(1.25);
        }
        .filter-panel-btn:active:enabled {
          filter: brightness(0.90);
          transform: scale(0.97);
        }
      `}</style>
      <div className="table-header-controls flex items-center justify-between mb-3" style={{ marginTop: 6, ...(confirmCloseAll ? { pointerEvents: 'none', opacity: 0.5 } : {}) }}>
        <div className="table-header-controls-inner flex items-center w-full">
          <div className="table-header-control relative flex items-center pl-4">
            {['position','execution','risk'].includes(currentType || '') ? (
              <div className="custom-dropdown" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center' }}>
                {fixedHeaderLabel}
              </div>
            ) : (
              <ThemedDropdown
                value={currentType}
                onChange={handleTableChange}
                width={140}
                options={dropdownOptions}
              />
            )}

          </div>
          <div className="flex items-center ml-12 gap-3 flex-1">
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
          {/* Switch: Filter icon first, then Close All Positions button */}
          <button
            className="table-header-icon-btn ml-auto flex items-center justify-center bg-transparent border-none p-0"
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
          <button
            className={`trade-primary-action table-header-action-btn ml-2 mr-4 px-3 py-1 rounded text-xs font-semibold transition-colors close-all-btn ${
              canTrade 
                ? 'bg-[#2C5680] text-white hover:bg-[#61AAD9] active:brightness-90 active:scale-95 cursor-pointer' 
                : 'bg-[#1a3a5c] text-[#4d7fa8] cursor-not-allowed'
            }`}
            onClick={canTrade ? () => setConfirmCloseAll(true) : undefined}
            disabled={!canTrade}
            style={{ minWidth: '100px' }}
            title={canTrade ? 'Close all positions' : 'Trading restricted to Entity Admin and Entity Trader roles'}
          >
            <Power className="trade-action-icon" size={13} strokeWidth={2.2} aria-hidden="true" />
            Close All Positions
          </button>
          {/* close button removed per design */}
        </div>
      </div>
      {filterPanelOpen && (
        <div className="trade-filter-panel bg-[#1A334C] rounded-lg p-3 mb-4 flex flex-col gap-2 w-full" style={{ width: '100%' }}>
          <div className="flex gap-2 items-center mb-2">
            <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal', color:'#fff'}}>Col:</span>
            <ThemedDropdown
              value={filterCol}
              onChange={setFilterCol}
              minWidth={140}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={columns.map(col => ({ value: col.key, label: col.label.replace(/\n/g, ' ') }))}
            />
            <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal', color:'#fff'}}>Op:</span>
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
            <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal', color:'#fff'}}>Val:</span>
            <input value={filterVal} onChange={e => setFilterVal(e.target.value)} className="px-2 py-1 rounded bg-[#102236] text-white filter-panel-label" style={{ minWidth: 100, fontSize:11, fontWeight:'normal' }} />
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
            <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal',fontFamily:'Segoe UI', color:'#fff'}}>Current Filters:</span>
            <ul className="bg-[#102236] rounded p-2 mt-1" style={{ minHeight: 40 }}>
              {filters.map((f, i) => (
                <li key={i} className="text-white flex items-center gap-2 mb-1 filter-panel-label" style={{fontSize:11, fontWeight:'normal'}}>
                  <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal'}}>{f.col} {f.op} {f.val}</span>
                  <button className="px-2 py-0.5 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{fontSize:11, fontWeight:'normal', borderWidth: '1px', borderStyle: 'solid'}} onClick={() => setFilters(fs => fs.filter((_, idx) => idx !== i))}>Remove</button>
                </li>
              ))}
              {filters.length === 0 && <li className="text-gray-400" style={{fontSize:11, fontFamily:'Segoe UI', fontWeight:'normal'}}>No filters added.</li>}
            </ul>
          </div>
          <div className="flex gap-2 items-center">
            <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal', fontFamily:'Segoe UI', color:'#fff'}}>Logic:</span>
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
      <style>{`
        .table-mono td, .table-mono th {
          font-family: 'Segoe UI';
          font-size: 14px;
          font-variant-ligatures: none;
          font-feature-settings: 'liga' 0;
        }
      `}</style>
      <div className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500" style={confirmCloseAll ? { pointerEvents: 'none', opacity: 0.5 } : {}}>
              {/* Gray overlay only over the table area, not the dialog */}
              {confirmCloseAll && (
                <div style={{
                  position: 'absolute',
                  top: '72px', // match dialog height
                  left: 0,
                  width: '100%',
                  height: 'calc(100% - 72px)',
                  background: 'rgba(80, 80, 80, 0.45)',
                  zIndex: 20,
                  pointerEvents: 'none',
                }} />
              )}
        <table className="w-full text-sm table-mono">
          <thead className="sticky top-0 bg-[#1A334C] z-10">
            <tr className="text-gray-300">
              {columns.map(col => (
                <th
                  key={col.key}
                  className="py-1 px-2 text-center font-semibold border-r border-gray-600 cursor-pointer select-none"
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
                    //...(col.key === 'Position' || col.key === 'Position Value' ? { minWidth: '70px' } : {})
                  }}
                >
                  {renderHeaderLabel(col.label)}
                  {sortColumn === col.key && (
                    hasSorted && (
                      <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#aaa', pointerEvents: 'none' }}>
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )
                  )}
                </th>
              ))}
              <th className="py-1 px-2 text-center font-semibold leading-tight" style={{ ...headerCellStyle, fontFamily: TABLE_HEADER_FONT, fontSize: TABLE_HEADER_FONT_SIZE, color: TABLE_HEADER_COLOR, fontWeight: TABLE_HEADER_FONT_WEIGHT }}>{renderHeaderLabel('Close\nPosition')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={row.Symbol || i} className={`border-b border-gray-700 hover:bg-[#1A334C]/50 ${
                i % 2 === 0 ? 'bg-[#0A1929]' : 'bg-[#102236]'
              }`} style={{ height: `${TABLE_BODY_ROW_HEIGHT}px` }}>
                <td className="py-1 px-2 text-white border-r border-gray-600 text-xs text-center" style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, fontWeight: 'normal' }}><span className="flex items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{row.Symbol}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: '13px', color: TABLE_CELL_COLOR, minWidth: '90px', whiteSpace: 'nowrap' }} className="py-1 px-1 font-mono text-gray-300 border-r border-gray-600 text-xs text-center"><span className="flex items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatNumberWithCommas(parseFloat(row.Position.replace(/[^0-9eE+.-]+/g, '')))}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: '13px', color: TABLE_CELL_COLOR, minWidth: '90px', whiteSpace: 'nowrap' }} className="py-1 px-1 font-mono text-gray-300 border-r border-gray-600 text-xs text-right"><span className="flex items-center justify-end w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatCurrency(parseFloat(row['Position Value'].replace(/[^0-9eE+.-]+/g, '')))}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }} className="py-1 px-2 font-mono text-gray-300 border-r border-gray-600 text-xs text-right"><span className="flex items-center justify-end w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatDecimals(row.Symbol, row['Avg Cost Rate'])}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE }} className={`py-1 px-2 font-mono border-r border-gray-600 text-xs text-right ${colorNumber(row['Unrealized PNL'])}`}><span className="flex items-center justify-end w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatCurrency(Math.round(parseFloat(row['Unrealized PNL'].replace(/[^0-9eE+.-]+/g, '')) || 0))}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE }} className={`py-1 px-2 font-mono border-r border-gray-600 text-xs text-right ${colorNumber(row['Realized PNL'])}`}><span className="flex items-center justify-end w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatCurrency(Math.round(parseFloat(row['Realized PNL'].replace(/[^0-9eE+.-]+/g, '')) || 0))}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }} className="py-1 px-2 font-mono text-gray-300 border-r border-gray-600 text-xs text-right"><span className="flex items-center justify-end w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatDecimals(row.Symbol, row.Bid)}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }} className="py-1 px-2 font-mono text-gray-300 border-r border-gray-600 text-xs text-right"><span className="flex items-center justify-end w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{formatDecimals(row.Symbol, row.Ask)}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }} className="py-1 px-2 text-gray-300 border-r border-gray-600 text-xs text-center"><span className="flex items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{row['Bid Venue']}</span></td>
                <td style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }} className="py-1 px-2 text-gray-300 border-r border-gray-600 text-xs text-center"><span className="flex items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{row['Ask Venue']}</span></td>
                <td className="py-1 px-2 text-center" style={bodyCellStyle}>
                  <div className="flex items-center justify-center" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>
                    <button 
                      onClick={canTrade ? () => closePosition(row.Symbol) : undefined}
                      disabled={!canTrade}
                      className={`${canTrade ? 'trade-primary-action trade-row-primary-action' : 'trade-secondary-action'} px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                        canTrade 
                          ? 'bg-[#2C5680] text-white hover:bg-[#61AAD9] active:brightness-90 active:scale-95 cursor-pointer' 
                          : 'bg-[#1a3a5c] text-[#4d7fa8] cursor-not-allowed'
                      }`}
                      title={canTrade ? 'Close position' : 'Trading restricted to Entity Admin and Entity Trader roles'}
                    >
                      Close
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
