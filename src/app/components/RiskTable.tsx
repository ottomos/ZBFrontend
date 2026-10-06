'use client';

import React, { useState } from 'react';
import { getSymbolOrder, TABLE_HEADER_ROW_HEIGHT, TABLE_HEADER_CONTENT_HEIGHT, TABLE_BODY_ROW_HEIGHT, TABLE_BODY_CONTENT_HEIGHT } from './tableConfig';
import { formatNumberWithCommas } from '../lib/numberFormatter';
import { User, canUserTrade } from '../types/user';
import { usePersistedState } from '../lib/usePersistedState';
import { ThemedDropdown } from './ThemedDropdown';
import { TradeHeaderLabel } from './TradeHeaderLabel';
import { AutoFitText } from './AutoFitText';

interface RiskRow {
  Symbol: string;
  KFHFeedStatus: string;
  IntegralFeedStatus: string;
  TradairFeedStatus: string;
  Feed360TStatus: string;
  StrategyStatus: string;
  PositionControl: string;
  LastOrderStatus: string;
  SpreadCheck: string;
  PositionFlowCheck: string;
  [key: string]: string | number; // <-- Add index signature for dynamic access
}

interface RiskTableProps {
  title: string;
  rows: RiskRow[];
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

type RiskStatusTone = 'normal' | 'warning' | 'critical' | 'closed' | 'neutral';

const getRiskStatusTone = (status: string): RiskStatusTone => {
  const normalized = status.trim().toLowerCase();
  if (['healthy', 'active', 'ok', 'running', 'no order', 'filled'].includes(normalized)) return 'normal';
  if (['above limit', 'warning', 'pending', 'delayed'].includes(normalized)) return 'warning';
  if (['stopped', 'disconnected', 'rejected'].includes(normalized)) return 'critical';
  if (normalized === 'closed') return 'closed';
  return 'neutral';
};

export function RiskTable({ title, rows, currentType = 'risk', onTableChange, onClose, selectedEntity = 'KT' }: RiskTableProps) {
  const symbolOrder = React.useMemo(() => getSymbolOrder(selectedEntity), [selectedEntity]);
  const [searchTerm, setSearchTerm] = usePersistedState('ui.search.dashboard.risk', '');
  // Start sorted by Symbol using SYMBOL_ORDER
  const [sortColumn, setSortColumn] = useState<string>('Symbol');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hasSorted, setHasSorted] = useState(false);

  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = usePersistedState<Array<{ col: string; op: string; val: string }>>('ui.filters.dashboard.risk', []);
  const [filterCol, setFilterCol] = useState('Symbol');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterVal, setFilterVal] = useState('');
  const [filterLogic, setFilterLogic] = usePersistedState<'AND' | 'OR'>('ui.filters.dashboard.risk.logic', 'AND');
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

  const formatCurrency = (value: number) => {
    return `$ ${formatNumberWithCommas(value)}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
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

  function getSortedRows(rows: RiskRow[]) {
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn as keyof RiskRow];
      const bVal = b[sortColumn as keyof RiskRow];
      
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

  // Filtering logic
  function filterRow(row: RiskRow) {
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

  // Filter rows based on search and filter panel
  const filteredRows = rows.filter(row =>
    (row.Symbol.toLowerCase().includes(searchTerm.toLowerCase())) &&
    filterRow(row)
  );
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
      {label.split('\n').map((line, i, arr) => (
        <React.Fragment key={`${label}-${line}-${i}`}>
          {line}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );

  // Entity-specific column configurations
  const getEntityColumns = (entity: string) => {
    const baseColumns = [{ key: 'Symbol', label: 'Symbol', align: 'center' }];
    
    switch (entity) {
      case 'KT': // Turkey
        return [
          ...baseColumns,
          { key: 'KFH Feed Status', label: 'KFH Feed\nStatus', align: 'center' },
          { key: 'Integral Feed Status', label: 'Integral Feed\nStatus', align: 'center' },
          { key: 'Tradair Feed Status', label: 'Tradair Feed\nStatus', align: 'center' },
          { key: 'T360T Feed Status', label: '360T Feed\nStatus', align: 'center' },
          { key: 'Strategy Status', label: 'Strategy\nStatus', align: 'center' },
          { key: 'Position Control', label: 'Position\nControl', align: 'center' },
          { key: 'Last Order Status', label: 'Last Order\nStatus', align: 'center' },
          { key: 'Spread Check', label: 'Spread\nCheck', align: 'center' },
          { key: 'Position Flow Check', label: 'Position\nFlow Check', align: 'center' }
        ];
      case 'KFH': // Kuwait
        return [
          ...baseColumns,
          { key: 'KT Feed Status', label: 'KT Feed\nStatus', align: 'center' },
          { key: 'T360T Feed Status', label: '360T Feed\nStatus', align: 'center' },
          { key: 'FXAll Feed Status', label: 'FXAll Feed\nStatus', align: 'center' },
          { key: 'Strategy Status', label: 'Strategy\nStatus', align: 'center' },
          { key: 'Position Control', label: 'Position\nControl', align: 'center' },
          { key: 'Last Order Status', label: 'Last Order\nStatus', align: 'center' },
          { key: 'Spread Check', label: 'Spread\nCheck', align: 'center' },
          { key: 'Position Flow Check', label: 'Position\nFlow Check', align: 'center' }
        ];
      case 'AUB': // Bahrain
        return [
          ...baseColumns,
          { key: 'KFH Feed Status', label: 'KFH Feed\nStatus', align: 'center' },
          { key: 'FXAll Feed Status', label: 'FXAll Feed\nStatus', align: 'center' },
          { key: 'KT Feed Status', label: 'KT Feed\nStatus', align: 'center' },
          { key: 'Strategy Status', label: 'Strategy\nStatus', align: 'center' },
          { key: 'Position Control', label: 'Position\nControl', align: 'center' },
          { key: 'Last Order Status', label: 'Last Order\nStatus', align: 'center' },
          { key: 'Spread Check', label: 'Spread\nCheck', align: 'center' },
          { key: 'Position Flow Check', label: 'Position\nFlow Check', align: 'center' }
        ];
      default:
        return [
          ...baseColumns,
          { key: 'KFH Feed Status', label: 'KFH Feed\nStatus', align: 'center' },
          { key: 'Integral Feed Status', label: 'Integral Feed\nStatus', align: 'center' },
          { key: 'Tradair Feed Status', label: 'Tradair Feed\nStatus', align: 'center' },
          { key: 'T360T Feed Status', label: '360T Feed\nStatus', align: 'center' },
          { key: 'Strategy Status', label: 'Strategy\nStatus', align: 'center' },
          { key: 'Position Control', label: 'Position\nControl', align: 'center' },
          { key: 'Last Order Status', label: 'Last Order\nStatus', align: 'center' },
          { key: 'Spread Check', label: 'Spread\nCheck', align: 'center' },
          { key: 'Position Flow Check', label: 'Position\nFlow Check', align: 'center' }
        ];
    }
  };

  const columns = getEntityColumns(selectedEntity);

  return (
    <div className="risk-table trade-blue-table bg-[#102236] p-2 h-full flex flex-col">
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
        </div>
      </div>
      <style>{`
        .table-mono td, .table-mono th {
          font-family: 'Segoe UI';
          font-size: 10px;
          font-variant-ligatures: none;
          font-feature-settings: 'liga' 0;
        }
      `}</style>
      {/* Filter panel UI */}
      {filterPanelOpen && (
        <div className="trade-filter-panel bg-[#1A334C] rounded-lg p-3 mb-4 flex flex-col gap-2 w-full" style={{ width: '100%' }}>
          <div className="flex gap-2 items-center mb-2">
            <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal', fontFamily:'Segoe UI', color:'#fff'}}>Col:</span>
            <ThemedDropdown
              value={filterCol}
              onChange={setFilterCol}
              minWidth={140}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={columns.map(col => ({ value: col.key, label: col.label.replace(/\n/g, ' ') }))}
            />
            <span className="filter-panel-label" style={{fontSize:11, fontFamily:'Segoe UI', fontWeight:'normal', color:'#fff'}}>Op:</span>
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
            <span className="filter-panel-label" style={{fontSize:11, fontFamily:'Segoe UI', fontWeight:'normal', color:'#fff'}}>Val:</span>
            <input value={filterVal} onChange={e => setFilterVal(e.target.value)} className="px-2 py-1 rounded bg-[#102236] text-white filter-panel-label" style={{ minWidth: 100, fontSize:11, fontFamily:'Segoe UI', fontWeight:'normal' }} />
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
            <span className="filter-panel-label" style={{fontSize:11, fontWeight:'normal', fontFamily:'Segoe UI', color:'#fff'}}>Current Filters:</span>
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
            <button className="px-3 py-1 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{ minWidth: '90px', fontSize:11, fontFamily:'Segoe UI', fontWeight:'normal', borderWidth: '1px', borderStyle: 'solid' }} onClick={() => setFilterPanelOpen(false)}>Apply</button>
            <button className="px-3 py-1 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{ minWidth: '90px', fontSize:11, fontFamily:'Segoe UI', fontWeight:'normal', borderWidth: '1px', borderStyle: 'solid' }} onClick={() => setFilters([])}>Clear All</button>
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
                    // Remove all width properties so columns can expand
                    minWidth:
                      col.key === 'KFHFeedStatus' ? '68px' :
                      col.key === 'PositionControl' || col.key === 'LastOrderStatus' || col.key === 'SpreadCheck' ? '60px' :
                      col.key.endsWith('FeedStatus') ? '80px' : undefined,
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
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={row.Symbol || i} className={`border-b border-gray-700 hover:bg-[#1A334C]/50 ${
                i % 2 === 0 ? 'bg-[#0A1929]' : 'bg-[#102236]'
              }`} style={{ height: `${TABLE_BODY_ROW_HEIGHT}px` }}>
                {columns.map((col, colIndex) => {
                  const isLastColumn = colIndex === columns.length - 1;
                  const cellValue = row[col.key] || '';
                  const isSymbol = col.key === 'Symbol';
                  const statusTone = getRiskStatusTone(String(cellValue));
                  const showStatusDot = statusTone === 'warning' || (statusTone === 'critical' && String(cellValue).trim().toLowerCase() !== 'stopped');
                  
                  return (
                    <td 
                      key={col.key}
                      className={`py-1 px-2 text-center ${
                        isSymbol 
                          ? 'text-white border-r border-gray-600 text-xs'
                          : `${isLastColumn ? '' : 'border-r border-gray-600'} trade-status-cell trade-status-cell--${statusTone}`
                      }`}
                      style={{ 
                        ...bodyCellStyle,
                        fontFamily: TABLE_CELL_FONT, 
                        fontSize: TABLE_CELL_FONT_SIZE, 
                        color: isSymbol ? TABLE_CELL_COLOR : undefined,
                        fontWeight: 'normal',
                        minWidth: isSymbol ? 'auto' : '60px'
                      }}
                    >
                      <span className={isSymbol ? 'flex h-full items-center justify-center w-full' : 'trade-status h-full w-full'} style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>
                        {!isSymbol && showStatusDot && <span className="trade-status-dot" aria-hidden="true" />}
                        {isSymbol ? cellValue : (
                          <AutoFitText
                            text={String(cellValue)}
                            maxFontSize={14}
                            minFontSize={9}
                            fontFamily={TABLE_CELL_FONT}
                            style={{ flex: 1, minWidth: 0 }}
                          />
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
