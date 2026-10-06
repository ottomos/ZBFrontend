'use client';

import React, { useState } from 'react';
import { getDefaultSymbols, getSymbolOrder } from './tableConfig';
import { parseDecimalValue, formatNumberWithCommas } from '../lib/numberFormatter';
import { User, canUserTrade } from '../types/user';
import { usePersistedState } from '../lib/usePersistedState';
import { ThemedDropdown } from './ThemedDropdown';


const DEFAULT_MANUAL_CARD_COUNT = 3;

interface ManualTradeTableProps {
  currentType?: string;
  onTableChange?: (t: string) => void;
  rows?: any[];
  selectedEntity?: string;
}

type CostMode = 'avg' | 'market' | 'custom';

interface ManualCard {
  symbol: string;
  clearQuantity: string;
  clearCheck: boolean;
  selectedCost: CostMode;
  customValue: string;
}

interface PersistedManualTradeState {
  cardCount: number;
  layoutKey: string;
  cards: ManualCard[];
}

const KT_MANUAL_TRADE_LIMIT_USD = 2_000_000;
const DEFAULT_MANUAL_TRADE_LIMIT_USD = 100_000_000;

function getManualTradeUsdLimit(entity?: string) {
  return String(entity || 'KFH').trim().toUpperCase() === 'KT'
    ? KT_MANUAL_TRADE_LIMIT_USD
    : DEFAULT_MANUAL_TRADE_LIMIT_USD;
}

function formatUsdLimitLabel(limit: number) {
  return formatNumberWithCommas(limit);
}

function formatUsdLimitShortLabel(limit: number) {
  return limit >= 1_000_000 ? `${limit / 1_000_000} million` : formatNumberWithCommas(limit);
}

export default function ManualTradeTable({ currentType, onTableChange, rows, selectedEntity }: ManualTradeTableProps) {
  const [canTrade, setCanTrade] = useState(false);
  const storageEntity = React.useMemo(() => String(selectedEntity || 'KFH').trim().toUpperCase() || 'KFH', [selectedEntity]);
  const manualTradeUsdLimit = React.useMemo(() => getManualTradeUsdLimit(storageEntity), [storageEntity]);
  const manualTradeUsdLimitLabel = React.useMemo(() => formatUsdLimitLabel(manualTradeUsdLimit), [manualTradeUsdLimit]);
  const manualTradeUsdLimitShortLabel = React.useMemo(() => formatUsdLimitShortLabel(manualTradeUsdLimit), [manualTradeUsdLimit]);
  const manualTradeStorageKey = React.useMemo(() => `ui.manualTrade.${storageEntity}`, [storageEntity]);
  const symbolOrder = React.useMemo(() => getSymbolOrder(selectedEntity), [selectedEntity]);
  const defaultSymbols = React.useMemo(() => getDefaultSymbols(selectedEntity, 7), [selectedEntity]);

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

  // derive symbol options from provided rows (Position & Price table), fallback to defaults
  const symbolOptions = React.useMemo(() => {
    try {
      const fromRows = (rows || []).map((r: any) => r.Symbol).filter(Boolean);
      const uniq = Array.from(new Set(fromRows));
      const base = uniq.length ? uniq : defaultSymbols;
      const orderMap = new Map(symbolOrder.map((s, i) => [s, i]));
      return [...base].sort((a, b) => {
        const ai = orderMap.has(a) ? (orderMap.get(a) as number) : Number.MAX_SAFE_INTEGER;
        const bi = orderMap.has(b) ? (orderMap.get(b) as number) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return String(a).localeCompare(String(b));
      });
    } catch (e) {
      return defaultSymbols;
    }
  }, [rows, defaultSymbols, symbolOrder]);

  // Position map derived directly from `rows` (Dashboard is the source of truth)
  const positionMap = React.useMemo(() => {
    const m = new Map<string, string>();
    try {
      (rows || []).forEach((r: any) => {
        const raw = r.Symbol ?? r.symbol;
        if (!raw) return;
        const sym = String(raw).trim();
        const pos = (r.Position ?? r['Position'] ?? r['Position Value'] ?? r.PositionValue ?? '').toString();
        m.set(sym, pos || '0');
      });
    } catch (e) {}
    return m;
  }, [rows]);

  // Map full row by symbol for reading fields like AvgCostRate
  const positionRowMap = React.useMemo(() => {
    const m = new Map<string, any>();
    try {
      (rows || []).forEach((r: any) => {
        const raw = r.Symbol ?? r.symbol;
        if (!raw) return;
        const sym = String(raw).trim();
        m.set(sym, r);
      });
    } catch (e) {}
    return m;
  }, [rows]);

  // Layout keys and their grid shapes.
  const LAYOUTS: Record<string, { count: number; cols: number; rows: number }> = {
    '2x1': { count: 2, cols: 2, rows: 1 },
    '3x1': { count: 3, cols: 3, rows: 1 },
    '1x2': { count: 2, cols: 1, rows: 2 },
    '2x2': { count: 4, cols: 2, rows: 2 },
    '3x2': { count: 6, cols: 3, rows: 2 },
    '2x3': { count: 6, cols: 2, rows: 3 },
    '4x2': { count: 8, cols: 4, rows: 2 },
  };
  const defaultLayoutKey = '3x1';
  const createCard = React.useCallback((): ManualCard => ({
    symbol: symbolOptions[0] ?? defaultSymbols[0] ?? '',
    clearQuantity: '0',
    clearCheck: false,
    selectedCost: 'avg',
    customValue: '0.0',
  }), [defaultSymbols, symbolOptions]);
  const [manualTradeState, setManualTradeState] = usePersistedState<PersistedManualTradeState>(
    manualTradeStorageKey,
    () => ({
      cardCount: DEFAULT_MANUAL_CARD_COUNT,
      layoutKey: defaultLayoutKey,
      cards: Array.from({ length: DEFAULT_MANUAL_CARD_COUNT }, createCard),
    })
  );
  const { cardCount, layoutKey, cards } = manualTradeState;
  const setCardCount = (value: number) => {
    setManualTradeState(prev => ({ ...prev, cardCount: value }));
  };
  const setLayoutKey = (value: string) => {
    setManualTradeState(prev => ({ ...prev, layoutKey: value }));
  };
  const setCards = (value: React.SetStateAction<ManualCard[]>) => {
    setManualTradeState(prev => ({
      ...prev,
      cards: typeof value === 'function' ? (value as (current: ManualCard[]) => ManualCard[])(prev.cards) : value,
    }));
  };
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);

  React.useEffect(() => {
    const allowedSymbols = new Set(symbolOptions.map(option => String(option)));
    const fallbackSymbol = symbolOptions[0] ?? defaultSymbols[0] ?? '';
    setManualTradeState(prev => {
      const resolvedLayoutKey = LAYOUTS[prev.layoutKey] ? prev.layoutKey : defaultLayoutKey;
      const resolvedCount = LAYOUTS[resolvedLayoutKey]?.count ?? DEFAULT_MANUAL_CARD_COUNT;
      let changed = resolvedLayoutKey !== prev.layoutKey || resolvedCount !== prev.cardCount;
      const nextCards = (Array.isArray(prev.cards) ? prev.cards : [])
        .slice(0, resolvedCount)
        .map(card => {
          const nextSymbol = allowedSymbols.has(String(card.symbol)) ? card.symbol : fallbackSymbol;
          const nextCard: ManualCard = {
            symbol: nextSymbol,
            clearQuantity: String(card.clearQuantity ?? '0'),
            clearCheck: Boolean(card.clearCheck),
            selectedCost: card.selectedCost === 'market' || card.selectedCost === 'custom' ? card.selectedCost : 'avg',
            customValue: String(card.customValue ?? '0.0'),
          };
          if (
            nextCard.symbol !== card.symbol ||
            nextCard.clearQuantity !== card.clearQuantity ||
            nextCard.clearCheck !== card.clearCheck ||
            nextCard.selectedCost !== card.selectedCost ||
            nextCard.customValue !== card.customValue
          ) {
            changed = true;
          }
          return nextCard;
        });

      while (nextCards.length < resolvedCount) {
        nextCards.push(createCard());
        changed = true;
      }

      if (!changed) {
        return prev;
      }

      return {
        cardCount: resolvedCount,
        layoutKey: resolvedLayoutKey,
        cards: nextCards,
      };
    });
  }, [LAYOUTS, createCard, defaultLayoutKey, defaultSymbols, setManualTradeState, symbolOptions]);

  const LayoutIcon = ({ keyProp, small = false }: { keyProp: string; small?: boolean }) => {
    const def = LAYOUTS[keyProp] ?? LAYOUTS[defaultLayoutKey];
    const total = def.rows * def.cols;
    const width = small ? 22 : 44;
    const height = small ? 14 : 28;
    const gap = small ? 2 : 4;
    const cellH = small ? 4 : 8;
    const colWidth = Math.floor((width - gap * (def.cols - 1)) / def.cols);
    return (
      <div style={{ width, height, display: 'grid', gridTemplateColumns: `repeat(${def.cols}, ${colWidth}px)`, gap }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ width: '100%', height: cellH, background: '#fff', opacity: 0.92, borderRadius: 2 }} />
        ))}
      </div>
    );
  };

  const updateCard = (index: number, update: Partial<ManualCard>) => {
    setCards((prev) =>
      prev.map((card, cardIndex) =>
        cardIndex === index ? { ...card, ...update } : card
      )
    );
  };

  const getPositionForSymbol = (sym: string) => {
    const key = String(sym || '').trim();
    const raw = positionMap.get(key) ?? '0';
    // keep raw string but if it contains commas or currency, return as-is
    return String(raw);
  };

  const isPreciousSymbol = (symbol: string) => String(symbol || '').trim().toUpperCase().startsWith('X');

  const formatQuantityForSymbol = (symbol: string, value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    if (isPreciousSymbol(symbol)) {
      return Math.max(0, safeValue).toFixed(5);
    }
    return String(Math.max(0, Math.floor(safeValue)));
  };

  const getSymbolDisplayLabel = (symbol: string) => {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (normalized.startsWith('X')) {
      return `${symbol} (oz)`;
    }
    return symbol;
  };

  const getFillAllUnitLabel = (symbol: string) => {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (normalized.startsWith('X')) {
      return '(oz)';
    }
    return String(symbol).split('/')[0]?.slice(0, 3) || '';
  };

  const getMaxQuantityForSymbol = (symbol: string) => {
    const row = positionRowMap.get(String(symbol || '').trim());
    const askRaw = row?.Ask ?? row?.ask ?? row?.['Ask Price'] ?? null;
    const askRate = parseDecimalValue(askRaw);

    if (/^USD/i.test(symbol)) {
      return manualTradeUsdLimit;
    }
    return manualTradeUsdLimit / askRate;
  };

  const clampQuantityForSymbol = (symbol: string, value: number) => {
    const nonNegative = Math.max(0, Number.isFinite(value) ? value : 0);
    const maxQty = getMaxQuantityForSymbol(symbol);
    const clamped = Number.isFinite(maxQty) ? Math.min(nonNegative, maxQty) : nonNegative;
    if (isPreciousSymbol(symbol)) {
      return Number(clamped.toFixed(5));
    }
    return Math.floor(clamped);
  };

  const getAutoLimitedQuantity = (symbol: string) => {
    const rawPosition = parseDecimalValue(getPositionForSymbol(symbol));
    const absPosition = Number.isFinite(rawPosition) ? Math.abs(rawPosition) : 0;
    return clampQuantityForSymbol(symbol, absPosition);
  };

  const toggleClearForIndex = (index: number) => {
    setCards(prev => prev.map((card, i) => {
      if (i !== index) return card;
      const newCheck = !card.clearCheck;
      if (newCheck) {
        return { ...card, clearCheck: true, clearQuantity: formatQuantityForSymbol(card.symbol, getAutoLimitedQuantity(card.symbol)) };
      }
      return { ...card, clearCheck: false, clearQuantity: '0' };
    }));
  };

  const handleClearQuantityChange = (index: number, value: string, symbol: string) => {
    if (isPreciousSymbol(symbol)) {
      const sanitized = String(value || '').replace(/[^0-9.]/g, '');
      const hasDecimalPoint = sanitized.includes('.');
      const [rawIntegerPart, ...decimalRest] = sanitized.split('.');
      const integerPart = (rawIntegerPart || '0').replace(/^0+(?=\d)/, '') || '0';
      const decimalPart = decimalRest.join('').slice(0, 5);
      const normalized = hasDecimalPoint ? `${integerPart}.${decimalPart}` : integerPart;
      updateCard(index, { clearQuantity: normalized || '0' });
      return;
    }

    const digitsOnly = String(value || '').replace(/\D/g, '');
    const parsed = Number.parseInt(digitsOnly, 10);
    const normalized = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    updateCard(index, { clearQuantity: String(normalized) });
  };

  const isQuantityOverLimit = (symbol: string, quantity: string) => {
    const qty = parseDecimalValue(quantity);
    if (!Number.isFinite(qty)) return false;
    const normalizedQty = isPreciousSymbol(symbol) ? Math.max(0, qty) : Math.max(0, Math.floor(qty));
    const maxQty = getMaxQuantityForSymbol(symbol);
    if (!Number.isFinite(maxQty)) return false;
    return normalizedQty > (isPreciousSymbol(symbol) ? maxQty : Math.floor(maxQty));
  };

  const isFillAllAutoLimited = (symbol: string) => {
    const rawPosition = parseDecimalValue(getPositionForSymbol(symbol));
    const absPosition = Number.isFinite(rawPosition) ? Math.abs(rawPosition) : 0;
    const maxQty = getMaxQuantityForSymbol(symbol);
    if (!Number.isFinite(maxQty)) return false;
    return absPosition > (isPreciousSymbol(symbol) ? maxQty : Math.floor(maxQty));
  };

  const handleCustomValueChange = (index: number, value: string) => {
    updateCard(index, { customValue: value });
  };

  // When positionMap updates (rows changed), update any checked cards to follow the latest value
  React.useEffect(() => {
    setCards(prev => prev.map(card => card.clearCheck
      ? { ...card, clearQuantity: formatQuantityForSymbol(card.symbol, getAutoLimitedQuantity(card.symbol)) }
      : card));
  }, [positionMap]);

  // No internal polling: ManualTradeTable derives values directly from `rows`.

  const handleCardCountChange = (n: number) => {
    setCardCount(n);
    setCards((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(createCard());
      return next;
    });
  };

  const handleLayoutChange = (key: string) => {
    const def = LAYOUTS[key] ?? LAYOUTS[defaultLayoutKey];
    setLayoutKey(key);
    handleCardCountChange(def.count);
    setLayoutMenuOpen(false);
  };

  const formatSystemDate = () => {
    const now = new Date();
    const date = now.toLocaleDateString('sv-SE');
    const time = now.toLocaleTimeString('en-GB', { hour12: false });
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${date} ${time}.${ms}`;
  };

  const sendManualTradeMessage = async (index: number, side: 'Buy' | 'Sell', priceLabel: string) => {
    try {
      const card = cards[index];
      if (!card) return;

      const entity = String(selectedEntity || 'KFH').trim().toUpperCase() || 'KFH';
      const topic = `PanelManualTrade_${entity}`;
      const userDataStr = localStorage.getItem('user');
      let userEmail = 'Unknown';
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          // Prefer email over username to ensure consistent format for Kafka production and display
          userEmail = userData?.email || userData?.username || 'Unknown';
        } catch (_) {
          userEmail = 'Unknown';
        }
      }

      const quantity = String(card.clearQuantity || '0');
      const parsedPrice = parseDecimalValue(priceLabel);
      const price = Number.isFinite(parsedPrice) ? String(parsedPrice) : String(priceLabel || '0');
      const systemDate = formatSystemDate();

      const csv = [
        card.symbol,
        price,
        side,
        quantity,
        'Unknown',
        'Unknown',
        'Unknown',
        userEmail,
        'Python',
        systemDate,
      ].join(',');

      await fetch('/api/manual-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          key: card.symbol,
          value: csv,
          profile: entity,
        }),
      });
    } catch (error) {
      console.error('Error sending manual trade message:', error);
    }
  };

  // Determine fallback number of columns from card count
  const cols = cardCount === 2 ? 1 : cardCount === 3 ? 3 : cardCount === 4 ? 2 : cardCount === 6 ? 2 : cardCount === 8 ? 4 : 2;
  const minCardWidth = layoutKey === '4x2' ? 255 : 0;

  const handleTableChange = React.useCallback((value: string) => onTableChange?.(value), [onTableChange]);
  const dropdownOptions = React.useMemo(() => [
    { value: 'strategy', label: 'Strategy' },
    ...(canTrade ? [{ value: 'manual-trade', label: 'Manual Trade' }] : []),
    ...(canTrade ? [{ value: 'providers', label: 'Providers' }] : []),
  ], [canTrade]);

  return (
    <div className="manual-trade-view trade-blue-table h-full w-full overflow-auto bg-[#102236] p-2" style={{ fontFamily: 'Segoe UI' }}>
      <div className="h-full">
        <div className="table-header-controls flex items-center mb-3" style={{ marginTop: 6 }}>
        <div className="table-header-control relative flex items-center pl-4">
          <ThemedDropdown
            value={currentType || 'manual-trade'}
            onChange={handleTableChange}
            width={160}
            options={dropdownOptions}
          />
        </div>
        <div className="ml-4 flex items-center gap-2 relative">
          <span className="inline-flex min-h-7 items-center text-xs text-white/80">Layout:</span>
          <div className="relative">
            <button
              onClick={() => setLayoutMenuOpen(v => !v)}
              className="trade-secondary-action table-header-action-btn mr-4 flex items-center gap-2 rounded px-2 py-1 text-sm"
            >
              <LayoutIcon keyProp={layoutKey} small={true} />
            </button>
            {layoutMenuOpen && (
              <div className="manual-trade-layout-menu absolute mt-1 rounded p-2 shadow-lg" style={{ zIndex: 60 }}>
                {Object.keys(LAYOUTS).map(k => (
                  <div key={k} className="flex items-center gap-2 p-1 cursor-pointer hover:bg-[#1f3946] rounded" onClick={() => handleLayoutChange(k)}>
                    <LayoutIcon keyProp={k} small={true} />
                    <span className="text-xs text-white/80">{k.replace('x', '×')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className="grid w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${LAYOUTS[layoutKey]?.cols ?? cols}, minmax(${minCardWidth}px, 1fr))` }}
      >
        {cards.map((state, index) => {
          const overLimit = isQuantityOverLimit(state.symbol, state.clearQuantity);
          const fillAllAutoLimited = state.clearCheck && isFillAllAutoLimited(state.symbol);
          return (
          <div
            key={index}
            className="manual-trade-card rounded-lg border p-3"
          >
            <div className="flex h-10 items-end justify-center border-b border-white/10 mb-1.5">
              <div className="flex items-center gap-2 pb-4">
                <ThemedDropdown
                  value={state.symbol}
                  align="center"
                  width={180}
                  buttonClassName="custom-dropdown manual-trade-symbol-dropdown flex items-center justify-between rounded border border-white/10 px-2 text-center text-sm text-white"
                  menuClassName="manual-trade-symbol-menu absolute left-0 top-full mt-1 rounded border border-white/10 py-1 shadow-lg"
                  optionClassName="manual-trade-symbol-option themed-dropdown-option block w-full px-3 py-1.5 text-white hover:bg-[#1A334C] disabled:cursor-not-allowed disabled:text-white/50"
                  menuZIndex={90}
                  options={symbolOptions.map((option: string) => ({ value: option, label: getSymbolDisplayLabel(option) }))}
                  onChange={(nextSymbol) => {
                    updateCard(index, {
                      symbol: nextSymbol,
                      ...(state.clearCheck ? { clearQuantity: formatQuantityForSymbol(nextSymbol, getAutoLimitedQuantity(nextSymbol)) } : {}),
                    });
                  }}
                />
              </div>
            </div>
            <div className="grid gap-1.5 text-sm">
              <div className="rounded-lg px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-xs text-[#BBC7D7]">Fill All</span>
                    <input
                      type="checkbox"
                      checked={state.clearCheck}
                      onChange={() => toggleClearForIndex(index)}
                      className="accent-white"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={isPreciousSymbol(state.symbol)
                        ? state.clearQuantity
                        : formatNumberWithCommas(parseDecimalValue(state.clearQuantity) || 0)}
                      onChange={(e) => handleClearQuantityChange(index, e.target.value, state.symbol)}
                      readOnly={state.clearCheck}
                      inputMode={isPreciousSymbol(state.symbol) ? 'decimal' : 'numeric'}
                      className={`w-[100px] rounded border border-white/10 px-1 py-0.5 text-right text-sm font-semibold ${overLimit ? 'text-[#FF4757]' : state.clearCheck ? 'bg-[#263544] text-white/60' : 'bg-transparent text-white'}`}
                    />
                    <span className="min-w-[24px] text-right text-xs font-semibold text-white/70">
                      {getFillAllUnitLabel(state.symbol)}
                    </span>
                  </div>
                </div>
                <div className={`mt-1 text-right text-[11px] ${overLimit ? 'text-[#FF4757]' : 'text-white/80'}`} style={{ fontFamily: 'Segoe UI' }}>
                  {overLimit
                    ? `Amount must be below USD ${manualTradeUsdLimitLabel} equivalent`
                    : fillAllAutoLimited
                      ?  <span className="text-[#FFC857]">Filled to limit (USD {manualTradeUsdLimitLabel} equivalent)</span>
                      : state.clearCheck
                        ? 'Filled by current net amount.'
                        : '\u00A0'}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-0.5 text-[11px]">
                {[
                  { labelTop: 'AVG COST', labelBottom: 'RATE', key: 'avg' as CostMode },
                  { labelTop: 'MARKET', labelBottom: 'RATE', key: 'market' as CostMode },
                  { labelTop: 'CUSTOM', labelBottom: '', key: 'custom' as CostMode },
                ].map((item) => (
                  <div
                    key={`${item.key}-${item.labelTop}-${item.labelBottom}`}
                    onClick={() => updateCard(index, { selectedCost: item.key })}
                    className={`manual-trade-mode min-w-0 flex flex-col gap-1 rounded border px-2 py-1.5 text-xs font-semibold uppercase transition-colors cursor-pointer ${state.selectedCost === item.key ? 'manual-trade-mode--active' : ''}`}
                  >
                    <div className="flex items-center justify-center w-full text-center leading-tight">
                      <span className="flex flex-col items-center leading-[1.5]">
                        <span>{item.labelTop}</span>
                        {item.labelBottom ? <span>{item.labelBottom}</span> : null}
                      </span>
                    </div>
                    {item.key === 'custom' && (
                      <input
                        type="text"
                        value={state.customValue}
                        onChange={(e) => handleCustomValueChange(index, e.target.value)}
                        disabled={state.selectedCost !== 'custom'}
                        onClick={(e) => e.stopPropagation()}
                        inputMode="decimal"
                        style={{ fontSize: 'clamp(8px, 0.9vw, 11px)', width: 'min(88px, 100%)' }}
                        className={`ml-auto h-[20px] min-w-0 rounded border px-1 text-right text-[11px] font-semibold ${state.selectedCost !== 'custom' ? 'border-[#1a3a5c] bg-[#142235] text-[#4d7fa8] cursor-not-allowed' : 'border-white/10 bg-[#0F1A2B] text-white'}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded-lg px-2 py-1.5">
                <div className="grid grid-cols-2 text-xs tracking-[0.3em] text-white/60">
                  <div className="flex justify-end">
                    <span className="w-[78%] text-center">SELL</span>
                  </div>
                  <div className="flex justify-start">
                    <span className="w-[78%] text-center">BUY</span>
                  </div>
                </div>
                <div className="mt-0.5 grid grid-cols-2 gap-1">
                    {(() => {
                const raw = getPositionForSymbol(state.symbol) ?? state.clearQuantity;
                const num = parseDecimalValue(raw);
                const sellDisabled = overLimit || (state.clearCheck && Number.isFinite(num) && num < 0);
                const buyDisabled = overLimit || (state.clearCheck && Number.isFinite(num) && num > 0);
                // Determine precision: default 5 decimals, but 3 for symbols starting with X or ending with /JPY
                const precision = (/^X/.test(String(state.symbol)) || /\/JPY$/.test(String(state.symbol))) ? 3 : 5;
                let customLabel: string | null = null;
                if (state.selectedCost === 'custom') {
                  const cv = parseDecimalValue(state.customValue);
                  customLabel = Number.isFinite(cv) ? cv.toFixed(precision) : '';
                }
                let avgLabel: string | null = null;
                if (state.selectedCost === 'avg') {
                  const row = positionRowMap.get(String(state.symbol).trim());
                  const avgRaw = row?.['Avg Cost Rate'] ?? row?.AvgCostRate ?? row?.['Avg Cost'] ?? row?.AvgCost ?? row?.Avg ?? null;
                  const avgNum = parseDecimalValue(avgRaw);
                  avgLabel = Number.isFinite(avgNum) ? avgNum.toFixed(precision) : '';
                }
                let marketBidLabel: string | null = null;
                let marketAskLabel: string | null = null;
                if (state.selectedCost === 'market') {
                  const row = positionRowMap.get(String(state.symbol).trim());
                  const bidRaw = row?.Bid ?? row?.bid ?? row?.['Bid Price'] ?? null;
                  const askRaw = row?.Ask ?? row?.ask ?? row?.['Ask Price'] ?? null;
                  const bidNum = parseDecimalValue(bidRaw);
                  const askNum = parseDecimalValue(askRaw);
                  marketBidLabel = Number.isFinite(bidNum) ? bidNum.toFixed(precision) : '';
                  marketAskLabel = Number.isFinite(askNum) ? askNum.toFixed(precision) : '';
                }
                const sellPrice = state.selectedCost === 'market'
                  ? (marketBidLabel ?? '43.1123')
                  : state.selectedCost === 'avg'
                    ? (avgLabel ?? '43.1123')
                    : (customLabel ?? '43.1123');
                const buyPrice = state.selectedCost === 'market'
                  ? (marketAskLabel ?? '44.1133')
                  : state.selectedCost === 'avg'
                    ? (avgLabel ?? '44.1133')
                    : (customLabel ?? '44.1133');
                const isPrecious = (/^X/.test(String(state.symbol)));

                return (
                  <>
                    <div className="relative w-full flex justify-end items-center">
                      {isPrecious && (
                        <span style={{ left: '-2px' }} className="absolute top-1/2 -translate-y-1/2 text-[11px] text-white/80 pointer-events-none">(oz)</span>
                      )}
                      <button
                        disabled={sellDisabled}
                        className={`trade-danger-action justify-self-end w-[78%] rounded border px-2 py-1.5 text-sm font-semibold transition-colors ${sellDisabled ? 'cursor-not-allowed' : 'active:brightness-90 active:scale-95 cursor-pointer'}`}
                        onClick={() => sendManualTradeMessage(index, 'Sell', sellPrice)}
                      >
                        <span className="text-sm font-bold">{sellPrice}</span>
                      </button>
                    </div>
                    <div className="relative w-full flex justify-start items-center">
                      <button
                        disabled={buyDisabled}
                        className={`trade-primary-action justify-self-start w-[78%] rounded border px-2 py-1.5 text-sm font-semibold transition-colors ${buyDisabled ? 'cursor-not-allowed' : 'active:brightness-90 active:scale-95 cursor-pointer'}`}
                        onClick={() => sendManualTradeMessage(index, 'Buy', buyPrice)}
                      >
                        <span className="text-sm font-bold">{buyPrice}</span>
                      </button>
                      {isPrecious && (
                        <span style={{ right: '-2px' }} className="absolute top-1/2 -translate-y-1/2 text-[11px] text-white/80 pointer-events-none">(oz)</span>
                      )}
                    </div>
                  </>
                );
                  })()}
                </div>
              </div>
            </div>
            {/* removed extra text per request */}
          </div>
        );})}
      </div>
      <div className="mt-2 px-1 text-[11px] text-white/80" style={{ fontFamily: 'Segoe UI' }}>
        <div>Each manual transaction is limited to a maximum of USD {manualTradeUsdLimitShortLabel}.</div>
      </div>
      </div>
    </div>
  );
}
