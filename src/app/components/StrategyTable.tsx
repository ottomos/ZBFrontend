'use client';

import React, { useState, useEffect } from "react";
import { flushSync } from 'react-dom';
import { useConfig } from "../context/ConfigContext";
import { getSymbolOrder, TABLE_HEADER_ROW_HEIGHT, TABLE_HEADER_CONTENT_HEIGHT, TABLE_BODY_ROW_HEIGHT, TABLE_BODY_CONTENT_HEIGHT } from './tableConfig';
import { User, canUserTrade } from '../types/user';
import { formatNumberWithCommas, parseDecimalValue } from "../lib/numberFormatter";
import { usePersistedState } from '../lib/usePersistedState';
import { ThemedDropdown } from './ThemedDropdown';
import { TradeHeaderLabel } from './TradeHeaderLabel';
import { Play, Square } from 'lucide-react';

interface StrategyRow {
  Symbol: string;
  Status: 'Running' | 'Stopped';
  TransferAccount: string;
  LongPositionLimit: number;
  ShortPositionLimit: number;
  MinHedge: number;
  HedgeRatio: number;
  TakeProfit: number;
  StopLoss: number;
  SpreadCheck: number;
  [key: string]: string | number; // <-- Add index signature for dynamic access
}

interface StrategyTableProps {
  title: string;
  rows: any[];
  currentType?: string;
  selectedEntity?: string;
  onTableChange?: (tableKey: string) => void;
  onClose?: () => void;
  currentUser?: User | null;
  positions?: any[]; // optional position/price rows to help validation
}

const TABLE_CELL_FONT = "'Segoe UI'";
const TABLE_CELL_FONT_SIZE = "14px";
const TABLE_CELL_COLOR = "#fff";
// Header styling constants (match DataTable)
const TABLE_HEADER_FONT = "'Segoe UI'";
const TABLE_HEADER_FONT_SIZE = "14px";
const TABLE_HEADER_COLOR = "#fff";
const TABLE_HEADER_WEIGHT = "bold"; // "normal" "bold" veya sayi: 600 gibi

export function StrategyTable({ title, rows, currentType = 'strategy', selectedEntity = 'KFH', onTableChange, onClose, currentUser, positions }: StrategyTableProps) {
  const config = useConfig();
  const symbolOrder = React.useMemo(() => getSymbolOrder(selectedEntity), [selectedEntity]);
  const [confirmAction, setConfirmAction] = useState<null | 'start' | 'stop'>(null);
  const [warning, setWarning] = useState<string | null>(null);
  // Overlay state: true if warning or confirmation dialog is active
  const overlayActive = Boolean(warning || confirmAction);
  // Used to keep X and Yes/No buttons responsive
  const isModal = Boolean(confirmAction);
  const [strategies, setStrategies] = useState<StrategyRow[]>(rows);
  const [searchTerm, setSearchTerm] = usePersistedState<string>(`ui.search.dashboard.${currentType || 'strategy'}`, '');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<StrategyRow | null>(null);
  const [editRowRaw, setEditRowRaw] = useState<{ [key: string]: string }>({});
  // Start sorted by Symbol using SYMBOL_ORDER
  const [sortColumn, setSortColumn] = useState<string>('Symbol');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hasSorted, setHasSorted] = useState(false);

  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = usePersistedState<Array<{ col: string; op: string; val: string }>>(`ui.filters.dashboard.${currentType || 'strategy'}`, []);
  const [filterCol, setFilterCol] = useState('Symbol');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterVal, setFilterVal] = useState('');
  const [filterLogic, setFilterLogic] = usePersistedState<'AND' | 'OR'>(`ui.filters.dashboard.${currentType || 'strategy'}.logic`, 'AND');

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

  const sendKafkaMessage = async (row: StrategyRow) => {
    // Format numbers as plain values (no thousands separators)
    function formatNumber(val: any) {
      if (typeof val === 'number') return val.toString();
      if (typeof val === 'string') return val.replace(/,/g, '').trim();
      return String(val);
    }
    // Format timestamp as HH:MM:SS.mmmmmm
    const offsetHours = 0;
    const now = new Date(Date.now() + offsetHours * 3600 * 1000);
    const timestamp =
      now.toLocaleString("sv-SE", { hour12: false }).replace(",", "") +
      "." +
      now.getMilliseconds().toString().padStart(3, "0");
    const email = currentUser?.email || '';
    const csv = [
      row.Symbol,
      row.Status,
      formatNumber(row.TransferAccount),
      formatNumber(row.LongPositionLimit),
      formatNumber(row.ShortPositionLimit),
      formatNumber(row.MinHedge),
      formatNumber(row.HedgeRatio),
      formatNumber(row.TakeProfit),
      formatNumber(row.StopLoss),
      formatNumber(row.SpreadCheck),
      'Python',
      timestamp,
      email
    ].join(',');
    // Use entity-specific topic
    const topicName = `PanelStrategy_${selectedEntity}`;
    try {
      await fetch(`/api/strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicName,
          key: row.Symbol,
          value: csv,
          profile: selectedEntity
        })
      });
      console.log(`📤 Strategy update sent for ${row.Symbol} to ${selectedEntity} (${topicName})`);
      console.log(`📄 Message content: ${csv}`);
    } catch (err) {
      console.error('Error sending Kafka message:', err);
    }
  };

  const toggleStrategy = async (index: number) => {
    setStrategies(prev => prev.map((row, i) => 
      i === index 
        ? { ...row, Status: row.Status === 'Running' ? 'Stopped' : 'Running' }
        : row
    ));
    // Send Kafka message for the toggled row
    const row = strategies[index];
    const newStatus = row.Status === 'Running' ? 'Stopped' : 'Running';
    const updatedRow: StrategyRow = { ...row, Status: newStatus as 'Running' | 'Stopped' };
    await sendKafkaMessage(updatedRow);
  };

  const startStrategy = (index: number) => {
    setStrategies(prev => prev.map((row, i) => 
      i === index ? { ...row, Status: 'Running' } : row
    ));
  };

  const stopStrategy = (index: number) => {
    setStrategies(prev => prev.map((row, i) => 
      i === index ? { ...row, Status: 'Stopped' } : row
    ));
  };

  const startAllStrategies = async () => {
    setStrategies(prev => prev.map(row => ({ ...row, Status: 'Running' as const })));
    // Send Kafka message for each strategy
    for (const row of strategies) {
      const updatedRow: StrategyRow = {
        ...row,
        Status: 'Running' as const,
      };
      await sendKafkaMessage(updatedRow);
    }
  };

  const stopAllStrategies = async () => {
    setStrategies(prev => prev.map((row) => ({ ...row, Status: 'Stopped' as const })));
    // Send Kafka message for each strategy
    for (const row of strategies) {
      const updatedRow = { ...row, Status: 'Stopped' as const };
      await sendKafkaMessage(updatedRow);
    }
  };

  const handleEditClick = (index: number) => {
    setEditIndex(index);
    setEditRow({ ...strategies[index] });
    // Initialize raw values for all editable fields. Numeric fields are shown
    // with thousand separators (matching the display mode) so the edit inputs
    // look the same as the table cells; the separators are stripped on save.
    const row = strategies[index];
    setEditRowRaw({
      TransferAccount: String(row.TransferAccount ?? ''),
      LongPositionLimit: formatNumberWithCommas(row.LongPositionLimit ?? ''),
      ShortPositionLimit: formatNumberWithCommas(row.ShortPositionLimit ?? ''),
      MinHedge: formatNumberWithCommas(row.MinHedge ?? ''),
      HedgeRatio: row.HedgeRatio !== undefined ? (row.HedgeRatio * 100).toString() : '',
      TakeProfit: formatNumberWithCommas(row.TakeProfit ?? ''),
      StopLoss: formatNumberWithCommas(row.StopLoss ?? ''),
      SpreadCheck: row.SpreadCheck !== undefined ? (row.SpreadCheck * 100).toString() : '',
    });
  };

  const NUMERIC_FIELDS = [
    'LongPositionLimit',
    'ShortPositionLimit',
    'MinHedge',
    'HedgeRatio',
    'TakeProfit',
    'StopLoss',
    'SpreadCheck',
  ];

  // Insert thousand separators into the integer part of a numeric string without
  // parsing it, so a trailing "." or fractional digits typed by the user survive.
  const formatEditableNumber = (value: string): string => {
    const cleaned = value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const match = cleaned.match(/^(-?)(\d*)(\.\d*)?$/);
    if (!match) return cleaned;
    const [, sign, intPart, decPart] = match;
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${formattedInt}${decPart ?? ''}`;
  };

  const handleEditChange = (field: keyof StrategyRow, value: string) => {
    // Only allow 0-9, -, ., , for numeric fields
    if (NUMERIC_FIELDS.includes(field as string)) {
      // Re-insert thousand separators as the user types so the input stays
      // readable and matches the display formatting of the table.
      setEditRowRaw(prev => ({ ...prev, [field]: formatEditableNumber(value) }));
    } else {
      setEditRowRaw(prev => ({ ...prev, [field]: value }));
    }
  };

  const validateStrategy = (row: StrategyRow): string | null => {
    try {
      const transferAmc = Number(row.TransferAccount);
      const longLimit = Number(row.LongPositionLimit);
      const shortLimit = Number(row.ShortPositionLimit);
      const minHedge = Number(row.MinHedge);
      const hedgeRatio = Number(row.HedgeRatio);
      const takeProfit = Number(row.TakeProfit);
      const stopLoss = Number(row.StopLoss);
      const spreadCheck = Number(row.SpreadCheck);

      // Validate Transfer Amount
      if (transferAmc < 0) {
        return "Transfer Amount cannot be negative !";
      }

      // Validate Long Position Limit
      if (longLimit <= 0) {
        return "Long Position Limit must be greater than zero !";
      }

      // Additional Long Position Limit checks against USD equivalent
      try {
        const sym = String(row.Symbol || '').trim().toUpperCase();
        // USD-prefixed symbols: hard cap 10,000,000
        if (sym.slice(0, 3) === 'USD') {
          if (longLimit > 10_000_000) {
            return "Long Position Limit must be below USD 10,000,000 equivalent.";
          }
        } else {
          // Try to derive Ask rate from available fields
          // First check the edited row
          let askRaw = (row as any).Ask ?? (row as any).ask ?? (row as any)['Ask Price'] ?? (row as any).AskRate ?? (row as any).AskPrice ?? null;
          // If not present, try positions prop (Position & Price table passed from Dashboard)
          if ((!askRaw || String(askRaw).trim() === '') && Array.isArray(positions)) {
            const pos = (positions as any).find((p: any) => String(p.Symbol || p.symbol || '').trim().toUpperCase() === sym);
            if (pos) {
              askRaw = pos.Ask ?? pos.ask ?? pos['Ask Price'] ?? pos.AskPrice ?? pos.AskRate ?? null;
            }
          }
          const askRate = parseDecimalValue(askRaw);
          if (!Number.isFinite(askRate) || askRate <= 0) {
            // Unable to validate against USD equivalent without Ask rate
            return "Ask price unavailable for symbol, cannot validate Long Position Limit.";
          }

          const maxAllowed = 10_000_000 / askRate;
          if (longLimit > maxAllowed) {
            return "Long Position Limit must be below USD 10,000,000 equivalent.";
          }
        }
      } catch (e) {
        return "Error validating Long Position Limit.";
      }

      // Validate Short Position Limit
      if (shortLimit >= 0) {
        return "Short Position Limit must be lower than zero !";
      }

      // Validate relationship between Long and Short limits
      if (shortLimit > longLimit) {
        return "Short Position Limit cannot exceed Long Position Limit !";
      }

      // Additional Short Position Limit checks against USD equivalent
      try {
        const symS = String(row.Symbol || '').trim().toUpperCase();
        // USD-prefixed symbols: hard floor -10,000,000
        if (symS.slice(0, 3) === 'USD') {
          if (shortLimit < -10_000_000) {
            return "Short Position Limit must be above USD -10,000,000 equivalent.";
          }
        } else {
          // Try to derive Ask rate from available fields
          let askRawS = (row as any).Ask ?? (row as any).ask ?? (row as any)['Ask Price'] ?? (row as any).AskRate ?? (row as any).AskPrice ?? null;
          if ((!askRawS || String(askRawS).trim() === '') && Array.isArray(positions)) {
            const posS = (positions as any).find((p: any) => String(p.Symbol || p.symbol || '').trim().toUpperCase() === symS);
            if (posS) {
              askRawS = posS.Ask ?? posS.ask ?? posS['Ask Price'] ?? posS.AskPrice ?? posS.AskRate ?? null;
            }
          }
          const askRateS = parseDecimalValue(askRawS);
          if (!Number.isFinite(askRateS) || askRateS <= 0) {
            return "Ask price unavailable for symbol, cannot validate Short Position Limit.";
          }

          const minAllowed = -10_000_000 / askRateS;
          if (shortLimit < minAllowed) {
            return "Short Position Limit must be above USD -10,000,000 equivalent.";
          }
        }
      } catch (e) {
        return "Error validating Short Position Limit.";
      }

      // Validate Min Hedge
      if (minHedge < 0) {
        return "Min Hedge cannot be negative !";
      }

      // Validate Min Hedge against Long Position Limit
      if (minHedge > longLimit) {
        return "Min Hedge cannot exceed Long Position Limit !";
      }

      // Validate Min Hedge against absolute Short Position Limit
      if (minHedge > Math.abs(shortLimit)) {
        return "Min Hedge cannot exceed abs(Short Position Limit) !";
      }

      // Validate Hedge Ratio (stored as decimal, convert to percentage for validation)
      const hedgeRatioPercentage = hedgeRatio * 100;
      if (!(0 <= hedgeRatioPercentage && hedgeRatioPercentage <= 100)) {
        return "Hedge Ratio must be between 0 and 100 !";
      }

      // Validate Take Profit
      if (takeProfit < 0) {
        return "Take Profit cannot be negative !";
      }

      // Validate Stop Loss
      if (stopLoss > 0) {
        return "Stop Loss cannot be positive !";
      }

      // Validate Spread Check (stored as decimal, convert to percentage for validation)
      const spreadCheckPercentage = spreadCheck * 100;
      if (!(0 <= spreadCheckPercentage && spreadCheckPercentage <= 100)) {
        return "Spread Check must be between 0 and 100 !";
      }

      return null; // No validation errors
    } catch (error) {
      return "All fields must be numeric values!";
    }
  };

  const handleEditSave = async () => {
    if (editIndex === null || !editRow) return;
    // Validate numeric fields
    for (const field of NUMERIC_FIELDS) {
      const val = editRowRaw[field];
      if (val === undefined || val === '') {
        setWarning(`Field ${field} cannot be empty.`);
        return;
      }
      // Remove commas for parsing
      const numVal = Number(String(val).replace(/,/g, ''));
      if (isNaN(numVal)) {
        setWarning(`Field ${field} must be a valid number.`);
        return;
      }
    }
    // Parse raw values
    const newRow: StrategyRow = { ...editRow };
    try {
      newRow.TransferAccount = editRowRaw.TransferAccount;
      newRow.LongPositionLimit = Number(editRowRaw.LongPositionLimit.replace(/,/g, ''));
      newRow.ShortPositionLimit = Number(editRowRaw.ShortPositionLimit.replace(/,/g, ''));
      newRow.MinHedge = Number(editRowRaw.MinHedge.replace(/,/g, ''));
      newRow.HedgeRatio = Number(editRowRaw.HedgeRatio.replace(/,/g, '')) / 100;
      newRow.TakeProfit = Number(editRowRaw.TakeProfit.replace(/,/g, ''));
      newRow.StopLoss = Number(editRowRaw.StopLoss.replace(/,/g, ''));
      newRow.SpreadCheck = Number(editRowRaw.SpreadCheck.replace(/,/g, '')) / 100;
    } catch {
      setWarning('All fields must be numeric values!');
      return;
    }
    // Validate the strategy before saving
    const validationError = validateStrategy(newRow);
    if (validationError) {
      setWarning(validationError);
      return;
    }
    const updatedStrategies = strategies.map((row, i) => i === editIndex ? { ...newRow } : row);
    setStrategies(updatedStrategies);
    await sendKafkaMessage(newRow);
    setEditIndex(null);
    setEditRow(null);
    setEditRowRaw({});
  };

  const handleEditCancel = () => {
    setEditIndex(null);
    setEditRow(null);
    setEditRowRaw({});
  };

  // Filtering logic
  function filterRow(row: StrategyRow) {
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

  // Filter strategies based on search term and filter panel
  const filteredStrategies = strategies.filter(strategy =>
    (strategy.Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      strategy.Status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      strategy.TransferAccount.toLowerCase().includes(searchTerm.toLowerCase())) &&
    filterRow(strategy)
  );

  function handleSort(col: string) {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
    setHasSorted(true);
  }

  function getSortedRows(rows: StrategyRow[]) {
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn as keyof StrategyRow];
      const bVal = b[sortColumn as keyof StrategyRow];
      
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

  const sortedRows = getSortedRows(filteredStrategies);
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
    { key: 'Symbol', label: 'Symbol', align: 'center' },
    { key: 'Status', label: 'Status', align: 'center' },
    { key: 'TransferAccount', label: 'Transfer\nAmount', align: 'right' },
    { key: 'LongPositionLimit', label: 'Long Pos.\nLimit', align: 'right' },
    { key: 'ShortPositionLimit', label: 'Short Pos.\nLimit', align: 'right' },
    { key: 'MinHedge', label: 'Min\nHedge', align: 'right' },
    { key: 'HedgeRatio', label: 'Hedge\nRatio', align: 'right' },
    { key: 'TakeProfit', label: 'Take\nProfit', align: 'right' },
    { key: 'StopLoss', label: 'Stop\nLoss', align: 'right' },
    { key: 'SpreadCheck', label: 'Spread', align: 'right' }
  ];

  // Update strategies when rows prop changes
  React.useEffect(() => {
    setStrategies(rows);
  }, [rows]);

  const handleTableChange = React.useCallback((value: string) => onTableChange?.(value), [onTableChange]);
  const dropdownOptions = React.useMemo(() => [
    { value: 'strategy', label: <TradeHeaderLabel type="strategy" /> },
    ...(canTrade ? [{ value: 'manual-trade', label: 'Manual Trade' }] : []),
    ...(canTrade ? [{ value: 'providers', label: 'Providers' }] : []),
  ], [canTrade]);

  return (
    <div className="strategy-table trade-blue-table bg-[#102236] p-2 h-full flex flex-col">
      {warning && (
        <div className="trade-alert trade-alert--critical" style={{
          background: '#FF4757',
          color: 'white',
          borderRadius: '8px',
          padding: '4px 16px',
          marginBottom: '12px',
          fontWeight: 600,
          fontSize: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #d63f51',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{fontSize: '18px', fontWeight: 700}}>!</span>
          <span>{warning}</span>
          <button
            onClick={() => setWarning(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#FF4757',
              fontWeight: 700,
              cursor: 'pointer',
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{fontSize: '19px', lineHeight: 1, color: 'white', fontWeight: 700}}>×</span>
          </button>
        </div>
      )}
      {confirmAction && (
        <div
          className={`trade-confirmation trade-confirmation--${confirmAction}`}
          style={{
            background: '#263544',
            color: 'white',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '12px',
            fontWeight: 600,
            fontSize: '15px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: confirmAction === 'start' ? '1px solid #2ECC71' : '1px solid #FF4757',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '18px', fontWeight: 700 }}>
            {confirmAction === 'start' ? '▶' : '■'}
          </span>
          <span style={{ flex: 1 }}>
            {confirmAction === 'start'
              ? 'Are you sure you want to START ALL strategies?'
              : 'Are you sure you want to STOP ALL strategies?'}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className={confirmAction === 'start' ? 'trade-primary-action' : 'trade-danger-action'}
              style={{
                background: confirmAction === 'start' ? '#2ECC71' : '#FF4757',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 18px',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'filter 0.15s, transform 0.1s'
              }}
              onClick={() => {
                const action = confirmAction;
                flushSync(() => setConfirmAction(null));
                globalThis.setTimeout(() => {
                  void (action === 'start' ? startAllStrategies() : stopAllStrategies());
                }, 0);
              }}
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
                transition: 'filter 0.15s, transform 0.1s'
              }}
              onClick={() => setConfirmAction(null)}
            >
              No
            </button>
          </div>
        </div>
      )}
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
      <div className="table-header-controls flex items-center justify-between mb-3" style={ { marginTop: 6, ...(overlayActive ? { pointerEvents: 'none', opacity: 0.5 } : {}) }}>
        <div className="table-header-controls-inner flex min-h-8 items-center w-full">
          <div className="table-header-control relative flex h-7 items-center pl-4">
            <ThemedDropdown
              value={currentType}
              onChange={handleTableChange}
              width={180}
              options={dropdownOptions}
            />
          </div>
          <div className="flex items-center ml-12 gap-3 flex-1">
            <span className="custom-table-search-label">Search:</span>
            <div className="table-header-control flex h-7 items-center gap-2">
              <input
                type="text"
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="custom-table-search-input h-7 leading-none"
              />
            </div>
          </div>
          {/* Switch: Filter icon first, then Start/Stop buttons */}
          <button
            className="table-header-icon-btn ml-auto flex h-7 w-7 items-center justify-center bg-transparent border-none p-0"
            onClick={overlayActive ? undefined : () => setFilterPanelOpen(v => !v)}
            style={{ cursor: overlayActive ? 'not-allowed' : 'pointer', background: 'none' }}
            title={filterPanelOpen ? 'Hide Filter Panel' : 'Show Filter Panel'}
            disabled={overlayActive}
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
            className={`trade-primary-action table-header-action-btn ml-2 inline-flex h-7 items-center justify-center px-3 rounded text-xs font-semibold border mr-2 leading-none transition-colors ${
              canTrade 
                ? 'bg-[#2ECC71] text-white border-[#2ECC71] hover:bg-[#27ae60] active:brightness-90 active:scale-95 cursor-pointer' 
                : 'bg-[#1a3a5c] text-[#4d7fa8] border-[#1a3a5c] cursor-not-allowed'
            }`}
            onClick={canTrade && !overlayActive ? () => setConfirmAction('start') : undefined}
            disabled={!canTrade || overlayActive}
            style={{ minWidth: '100px' }}
            title={canTrade ? 'Start all strategies' : 'Trading restricted to Entity Admin and Entity Trader roles'}
          >
            <Play className="trade-action-icon" size={13} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
            START ALL
          </button>
          <button
            className={`trade-danger-action table-header-action-btn ml-2 mr-4 inline-flex h-7 items-center justify-center px-3 rounded text-xs font-semibold border leading-none transition-colors ${
              canTrade 
                ? 'bg-[#FF4757] text-white border-[#FF4757] hover:bg-[#d63f51] active:brightness-90 active:scale-95 cursor-pointer' 
                : 'bg-[#1a3a5c] text-[#4d7fa8] border-[#1a3a5c] cursor-not-allowed'
            }`}
            onClick={canTrade && !overlayActive ? () => setConfirmAction('stop') : undefined}
            disabled={!canTrade || overlayActive}
            style={{ minWidth: '100px' }}
            title={canTrade ? 'Stop all strategies' : 'Trading restricted to Entity Admin and Entity Trader roles'}
          >
            <Square className="trade-action-icon" size={11} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
            STOP ALL
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
                  <span className="filter-panel-label" style={{fontSize:11, fontFamily:'Segoe UI',fontWeight:'normal'}}>{f.col} {f.op} {f.val}</span>
                  <button className="px-2 py-0.5 rounded text-xs border border-white bg-[#102236] text-white filter-panel-btn" style={{fontSize:11, fontFamily:'Segoe UI',fontWeight:'normal', borderWidth: '1px', borderStyle: 'solid'}} onClick={() => setFilters(fs => fs.filter((_, idx) => idx !== i))}>Remove</button>
                </li>
              ))}
              {filters.length === 0 && <li className="text-gray-400" style={{fontSize:11, fontFamily:'Segoe UI', fontWeight:'normal'}}>No filters added.</li>}
            </ul>
          </div>
          <div className="flex gap-2 items-center">
            <span style={{fontSize:11, fontWeight:'normal', fontFamily:'Segoe UI', color:'#fff'}}>Logic:</span>
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
          font-family: ${TABLE_CELL_FONT};
          font-size: ${TABLE_CELL_FONT_SIZE};
          font-variant-ligatures: none;
          font-feature-settings: 'liga' 0;
        }
        /* Hide number input spinner arrows */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
      <div className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500" style={overlayActive ? { pointerEvents: 'none', opacity: 0.5 } : {}}>
        <table className="w-full text-sm table-mono">
          <thead className="sticky top-0 bg-[#1A334C] z-10">
            <tr className="text-gray-300">
              <th
                className="py-1 px-2 text-center font-semibold border-r border-gray-600 leading-tight"
                style={{
                  ...headerCellStyle,
                  fontFamily: TABLE_HEADER_FONT,
                  fontSize: TABLE_HEADER_FONT_SIZE,
                  color: TABLE_HEADER_COLOR,
                  fontWeight: TABLE_HEADER_WEIGHT,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {renderHeaderLabel('Start/\nStop')}
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="py-1 px-2 text-center font-semibold border-r border-gray-600 cursor-pointer select-none"
                  onClick={() => handleSort(col.key)}
                  style={{
                    ...headerCellStyle,
                    fontFamily: TABLE_HEADER_FONT,
                    fontSize: TABLE_HEADER_FONT_SIZE,
                    color: TABLE_HEADER_COLOR,
                    fontWeight: TABLE_HEADER_WEIGHT,
                    userSelect: 'none',
                    position: 'relative',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {renderHeaderLabel(col.label)}
                  {sortColumn === col.key && (
                    hasSorted && (
                      <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#aaa', pointerEvents: 'none', fontFamily: 'Segoe UI' }}>
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )
                  )}
                </th>
              ))}
              <th
                className="py-1 px-2 text-center font-semibold"
                style={{
                  ...headerCellStyle,
                  fontFamily: TABLE_HEADER_FONT,
                  fontSize: TABLE_HEADER_FONT_SIZE,
                  color: TABLE_HEADER_COLOR,
                  fontWeight: TABLE_HEADER_WEIGHT,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {renderHeaderLabel('Edit')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => {
              const originalIndex = strategies.findIndex(s => s.Symbol === row.Symbol);
              const isEditing = editIndex === originalIndex;
              return (
                <tr key={index} className={`border-b border-gray-700 hover:bg-[#1A334C]/50 ${index % 2 === 0 ? 'bg-[#0A1929]' : 'bg-[#102236]'} ${overlayActive ? 'pointer-events-none opacity-50' : ''}`} style={{ height: `${TABLE_BODY_ROW_HEIGHT}px` }}> 
                  <td className="py-0 px-1 border-r border-gray-600" style={{ ...bodyCellStyle, minWidth: '48px', maxWidth: '60px', width: '62px', overflow: 'hidden', textAlign: 'center', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    <label 
                      className={`relative flex items-center justify-center w-full ${canTrade ? 'cursor-pointer' : 'cursor-not-allowed'}`} 
                      style={{ minWidth: '38px', maxWidth: '54px', height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}
                      title={canTrade ? 'Toggle strategy start/stop' : 'Trading restricted to Entity Admin and Entity Trader roles'}
                    >
                      <input
                        type="checkbox"
                        checked={row.Status === 'Running'}
                        onChange={canTrade ? () => toggleStrategy(originalIndex) : undefined}
                        disabled={!canTrade}
                        className="sr-only peer"
                      />
                      <div 
                        className="trade-toggle-track relative w-full rounded-lg transition-colors flex items-center peer-focus:outline-none peer"
                        style={{
                          minWidth: '40px', maxWidth: '56px', height: '20px',
                          background: canTrade
                              ? (row.Status === 'Running' ? 'var(--primary)' : 'var(--disabled-bg)')
                            : 'var(--disabled-bg)',
                        }}
                      >
                        <div className="absolute top-1/2 transform -translate-y-1/2 rounded-full h-5 w-5 transition-all duration-200"
                          style={{
                            background: canTrade ? 'var(--text-primary)' : 'var(--disabled-text)',
                            [row.Status === 'Running' ? 'right' : 'left']: 0,
                          }}
                        ></div>
                      </div>
                    </label>
                  </td>
                  <td className="py-1 px-2 text-white border-r border-gray-600 text-xs text-center" style={{ ...bodyCellStyle, minWidth: '86px', maxWidth: '86px', width: '86px', boxSizing: 'border-box', padding: '2px 4px', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, fontWeight: 'normal' }}>
                    <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'center', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, fontWeight: 'normal' }}>{row.Symbol}</span>
                  </td>
                  <td className={`trade-status-cell trade-status-cell--${row.Status === 'Running' ? 'normal' : 'critical'} border-r border-gray-600 text-center text-xs`} style={{ ...bodyCellStyle, minWidth: '58px', maxWidth: '76px', width: '70px', boxSizing: 'border-box', padding: '2px 4px', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, fontWeight: 'normal' }}>
                    <div className="trade-status" style={{ width: '100%', height: '24px', minWidth: '56px', maxWidth: '74px' }}>
                      {row.Status}
                    </div>
                  </td>
                  {/* TransferAccount */}
                  <td className="py-1 px-2 border-r border-gray-600 text-xs text-right" style={{ ...bodyCellStyle, minWidth: '80px', maxWidth: '120px', width: '90px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    {isEditing ? (
                      <input type="text" value={editRowRaw.TransferAccount ?? ''} onChange={e => handleEditChange('TransferAccount', e.target.value)} style={{ backgroundColor: '#FFC312', color: 'black', border: '1px solid #FFC312', borderRadius: 3, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>{row.TransferAccount}</span>
                    )}
                  </td>
                  {/* LongPositionLimit */}
                  <td className="py-1 px-2 border-r border-gray-600 text-xs text-right" style={{ ...bodyCellStyle, minWidth: '84px', maxWidth: '104px', width: '96px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    {isEditing ? (
                      <input type="text" value={editRowRaw.LongPositionLimit ?? ''} onChange={e => handleEditChange('LongPositionLimit', e.target.value)} style={{ backgroundColor: '#FFC312', color: 'black', border: '1px solid #FFC312', borderRadius: 3, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>{formatNumberWithCommas(row.LongPositionLimit)}</span>
                    )}
                  </td>
                  {/* ShortPositionLimit */}
                  <td className="py-1 px-2 border-r border-gray-600 text-xs text-right" style={{ ...bodyCellStyle, minWidth: '83px', maxWidth: '104px', width: '96px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    {isEditing ? (
                      <input type="text" value={editRowRaw.ShortPositionLimit ?? ''} onChange={e => handleEditChange('ShortPositionLimit', e.target.value)} style={{ backgroundColor: '#FFC312', color: 'black', border: '1px solid #FFC312', borderRadius: 3, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>{formatNumberWithCommas(row.ShortPositionLimit)}</span>
                    )}
                  </td>
                  {/* MinHedge */}
                  <td className="py-1 px-2 border-r border-gray-600 text-xs text-right" style={{ ...bodyCellStyle, minWidth: '80px', maxWidth: '110px', width: '85px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    {isEditing ? (
                      <input type="text" value={editRowRaw.MinHedge ?? ''} onChange={e => handleEditChange('MinHedge', e.target.value)} style={{ backgroundColor: '#FFC312', color: 'black', border: '1px solid #FFC312', borderRadius: 3, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>{formatNumberWithCommas(row.MinHedge)}</span>
                    )}
                  </td>
                  {/* HedgeRatio */}
                  <td className="py-1 px-2 border-r border-gray-600 text-xs text-right" style={{ ...bodyCellStyle, minWidth: '52px', maxWidth: '68px', width: '60px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    {isEditing ? (
                      <input type="text" value={editRowRaw.HedgeRatio ?? ''} onChange={e => handleEditChange('HedgeRatio', e.target.value)} style={{ backgroundColor: '#FFC312', color: 'black', border: '1px solid #FFC312', borderRadius: 3, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>{((row.HedgeRatio || 0) * 100).toFixed(0)}%</span>
                    )}
                  </td>
                  {/* TakeProfit */}
                  <td className="py-1 px-2 border-r border-gray-600 text-xs text-right" style={{ ...bodyCellStyle, minWidth: '68px', maxWidth: '88px', width: '70px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    {isEditing ? (
                      <input type="text" value={editRowRaw.TakeProfit ?? ''} onChange={e => handleEditChange('TakeProfit', e.target.value)} style={{ backgroundColor: '#FFC312', color: 'black', border: '1px solid #FFC312', borderRadius: 3, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>{(row.TakeProfit || 0).toFixed(4)}</span>
                    )}
                  </td>
                  {/* StopLoss */}
                  <td className="py-1 px-2 border-r border-gray-600 text-xs text-right" style={{ ...bodyCellStyle, minWidth: '75px', maxWidth: '100px', width: '75px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    {isEditing ? (
                      <input type="text" value={editRowRaw.StopLoss ?? ''} onChange={e => handleEditChange('StopLoss', e.target.value)} style={{ backgroundColor: '#FFC312', color: 'black', border: '1px solid #FFC312', borderRadius: 3, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 6px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>{(row.StopLoss || 0).toFixed(4)}</span>
                    )}
                  </td>
                  {/* SpreadCheck */}
                  <td className="py-1 px-2 border-r border-gray-600 text-xs text-right" style={{ ...bodyCellStyle, minWidth: '52px', maxWidth: '68px', width: '60px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>
                    {isEditing ? (
                      <input type="text" value={editRowRaw.SpreadCheck ?? ''} onChange={e => handleEditChange('SpreadCheck', e.target.value)} style={{ backgroundColor: '#FFC312', color: 'black', border: '1px solid #FFC312', borderRadius: 3, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '100%', height: '24px', boxSizing: 'border-box', padding: '2px 4px', textAlign: 'right', fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }}>{((row.SpreadCheck || 0) * 100).toFixed(1)}%</span>
                    )}
                  </td>
                  {/* Edit button cell untouched */}
                  <td className="py-1 px-2 text-center" style={{ ...bodyCellStyle, minWidth: '83px', maxWidth: '98px', width: '85px', boxSizing: 'border-box', padding: '2px 6px', overflow: 'hidden' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', width: '100%', height: '22px', justifyContent: 'center', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                        <button 
                          style={{ width: '50%', minWidth: 0, maxWidth: '40px', height: '22px', fontSize: 11, fontFamily: 'Segoe UI', letterSpacing: '0.5px', padding: 0, overflow: 'hidden' }} 
                          className={`trade-primary-action rounded font-semibold transition-colors ${
                            canTrade 
                              ? 'bg-[#2C5680] text-white hover:bg-[#61AAD9] active:brightness-90 active:scale-95 cursor-pointer' 
                              : 'bg-[#1a3a5c] text-[#4d7fa8] cursor-not-allowed'
                          }`}
                          onClick={canTrade && (!overlayActive || isModal) ? handleEditSave : undefined}
                          disabled={!canTrade || (overlayActive && !isModal)}
                          title={canTrade ? 'Save changes' : 'Trading restricted to Entity Admin and Entity Trader roles'}
                        >
                          Save
                        </button>
                        <button 
                          style={{ width: '50%', minWidth: 0, maxWidth: '40px', height: '22px', fontSize: 9, fontFamily: 'Segoe UI', letterSpacing: '0.5px', padding: 0, overflow: 'hidden' }} 
                          className="trade-danger-action text-white rounded font-semibold active:brightness-90 active:scale-95" 
                          onClick={handleEditCancel}
                          disabled={false}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button 
                        style={{ width: '100%', minWidth: 0, maxWidth: '60px', height: '22px', fontSize: 12, fontFamily: 'Segoe UI', letterSpacing: '0.5px', padding: 0, overflow: 'hidden' }} 
                        className={`${canTrade ? 'trade-primary-action trade-row-primary-action' : 'trade-secondary-action'} rounded text-xs font-semibold transition-colors ${
                          canTrade 
                            ? 'bg-[#2C5680] text-white hover:bg-[#61AAD9] active:brightness-90 active:scale-95 cursor-pointer' 
                            : 'bg-[#1a3a5c] text-[#4d7fa8] cursor-not-allowed'
                        }`}
                        onClick={canTrade && (!overlayActive || isModal) ? () => handleEditClick(originalIndex) : undefined}
                        disabled={!canTrade || (overlayActive && !isModal)}
                        title={canTrade ? 'Edit strategy' : 'Trading restricted to Entity Admin and Entity Trader roles'}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    {/* Gray overlay only over the table, starting just below the dialog, with extra space to avoid overlap */}
    {overlayActive && (
      <div style={{
        position: 'absolute',
        top: '72px', // move further down to clear the dialog box
        left: 0,
        width: '100%',
        height: 'calc(100% - 72px)',
        background: 'rgba(80, 80, 80, 0.45)',
        zIndex: 20,
        pointerEvents: 'none',
      }} />
    )}
    </div>
  );
}
