'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { User, canUserTrade } from '../types/user';
import { getSymbolOrder, TABLE_HEADER_ROW_HEIGHT, TABLE_HEADER_CONTENT_HEIGHT, TABLE_BODY_ROW_HEIGHT, TABLE_BODY_CONTENT_HEIGHT } from './tableConfig';
import { ThemedDropdown } from './ThemedDropdown';

type ProviderRow = Record<string, string | number | undefined>;

interface ProviderTableProps {
  title?: string;
  rows: ProviderRow[];
  currentType?: string;
  selectedEntity?: string;
  onTableChange?: (tableKey: string) => void;
}

const TABLE_CELL_FONT = "'Segoe UI'";
const TABLE_CELL_FONT_SIZE = "14px";
const TABLE_CELL_COLOR = "#fff";
const TABLE_HEADER_FONT = "'Segoe UI'";
const TABLE_HEADER_FONT_SIZE = "14px";
const TABLE_HEADER_COLOR = "#fff";
const TABLE_HEADER_FONT_WEIGHT = "bold";

export function ProviderTable({ rows, currentType = 'providers', selectedEntity = 'KFH', onTableChange }: Readonly<ProviderTableProps>) {
  const [providers, setProviders] = useState<ProviderRow[]>(rows);
  const [canTrade, setCanTrade] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setProviders(rows);
  }, [rows]);

  useEffect(() => {
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

  const providerKeys = useMemo(() => {
    if (!providers.length) return [] as string[];

    const sample = providers.find((row) => String(row.Symbol || '').trim().length > 0) || providers[0];
    const keys = Object.keys(sample || {});
    const strategyIndex = keys.findIndex((key) => key.toLowerCase() === 'strategy status');

    if (strategyIndex > 1) {
      return keys.slice(1, strategyIndex);
    }

    return keys.filter((key) => key !== 'Symbol' && key !== 'Strategy Status' && key !== 'Position Control' && key !== 'Last Order Status' && key !== 'Spread Check' && key !== 'Position Flow Check');
  }, [providers]);

  const filteredProviders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return providers;

    return providers.filter((row) => String(row.Symbol || '').toLowerCase().includes(term));
  }, [providers, searchTerm]);

  const normalizeSymbol = (raw?: string | number) => {
    let s = String(raw || '').trim();
    if (!s) return s;
    // Normalize case for checks but keep original casing in result
    const first = s.charAt(0);
    const second = s.at(1) || '';
    const last = s.at(-1) || '';
    const firstUp = first.toUpperCase();
    const lastUp = last.toUpperCase();

    // If leading T and either the second char is a digit or it also ends with T, drop the leading T.
    if (firstUp === 'T' && (/\d/.test(second) || lastUp === 'T')) {
      s = s.slice(1);
    }

    return s;
  };

  const sortedProviders = useMemo(() => {
    const symbolOrder = getSymbolOrder(selectedEntity);
    const rank = new Map(symbolOrder.map((symbol, index) => [String(symbol).trim().toUpperCase(), index]));

    return [...filteredProviders].sort((a, b) => {
      const aSymbol = normalizeSymbol(String(a.Symbol || '').trim());
      const bSymbol = normalizeSymbol(String(b.Symbol || '').trim());
      const aKey = aSymbol.toUpperCase();
      const bKey = bSymbol.toUpperCase();
      const aRank = rank.get(aKey);
      const bRank = rank.get(bKey);

      if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
      if (aRank !== undefined) return -1;
      if (bRank !== undefined) return 1;
      return aSymbol.localeCompare(bSymbol);
    });
  }, [filteredProviders, selectedEntity]);

  const handleTableChange = React.useCallback((value: string) => onTableChange?.(value), [onTableChange]);
  const dropdownOptions = React.useMemo(() => [
    { value: 'strategy', label: 'Strategy' },
    { value: 'manual-trade', label: 'Manual Trade' },
    { value: 'providers', label: 'Providers' },
  ], []);

  const isOnStatus = (value: unknown) => {
    const normalized = (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      ? String(value).trim().toLowerCase()
      : '';
    return normalized === 'true' || normalized === 'healthy' || normalized === 'disconnected';
  };

  const displayProviderName = (key: string) => key.replace(/\s*Feed Status\s*/i, '').trim();
  const renderHeaderLabel = (label: string) => (
    <span className="flex w-full items-center justify-center text-center leading-tight" style={{ height: `${TABLE_HEADER_CONTENT_HEIGHT}px` }}>
      {label}
    </span>
  );

  const getSymbolKey = (row: ProviderRow) => String(row.Symbol || '').trim().toUpperCase();

  const getProviderState = (row: ProviderRow, key: string) => {
    return isOnStatus(row[key]);
  };

  const formatTimestamp = () => {
    const now = new Date();
    const base = now.toLocaleString('sv-SE', { hour12: false }).replace(',', '');
    const millis = now.getMilliseconds().toString().padStart(3, '0');
    return `${base}.${millis}`;
  };

  const handleToggle = async (row: ProviderRow, key: string) => {
    const symbol = normalizeSymbol(row.Symbol);
    const symbolKey = normalizeSymbol(getSymbolKey(row));
    const updatedRow: ProviderRow = {
      ...row,
      [key]: getProviderState(row, key) ? 'False' : 'True',
    };

    setProviders((prev) => prev.map((provider) => {
      if (normalizeSymbol(getSymbolKey(provider)) !== symbolKey) {
        return provider;
      }

      return updatedRow;
    }));

    const statuses = providerKeys.map((providerKey) => {
      const providerValue = getProviderState(updatedRow, providerKey);
      return providerValue ? 'True' : 'False';
    });
    const payload = `${symbol},${statuses.join(',')},Python,${formatTimestamp()}`;

    try {
      const response = await fetch('/api/risk-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `PanelProvider_${selectedEntity}`,
          key: symbol,
          value: payload,
          profile: selectedEntity,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send provider update (${response.status})`);
      }
    } catch (error) {
      console.error('Error sending provider update:', error);
      setProviders((prev) => prev.map((provider) => {
        if (normalizeSymbol(getSymbolKey(provider)) !== symbolKey) {
          return provider;
        }

        return row;
      }));
    }
  };

  if (!canTrade) {
    return null;
  }

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

  const renderSwitch = (value: boolean, onClick: () => void) => (
    <div className="flex items-center justify-center w-full">
      <label className="relative flex items-center justify-center cursor-pointer" style={{ minWidth: '42px', maxWidth: '58px', height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>
        <span className="sr-only">Toggle provider status</span>
        <input
          type="checkbox"
          checked={value}
          onChange={() => onClick()}
          className="sr-only peer"
        />
        <div
          className="trade-toggle-track relative w-full rounded-lg transition-colors flex items-center peer-focus:outline-none peer"
          style={{ minWidth: '44px', maxWidth: '60px', height: '20px' }}
        >
          <div className={`absolute top-1/2 -translate-y-1/2 bg-white rounded-full h-5 w-5 transition-all duration-200 ${value ? 'right-0' : 'left-0'}`}></div>
        </div>
      </label>
    </div>
  );

  return (
    <div className="provider-table trade-blue-table bg-[#102236] p-2 h-full flex flex-col">
      <div className="table-header-controls flex items-center justify-between mb-3" style={{ marginTop: 6 }}>
        <div className="table-header-control relative flex items-center pl-4">
          <ThemedDropdown
            value={currentType || 'providers'}
            onChange={handleTableChange}
            width={160}
            options={dropdownOptions}
          />
        </div>
        <div className="flex items-center ml-12 mr-4 gap-3 flex-1">
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
      </div>
      <div className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
        <table className="w-full text-sm table-mono">
          <thead className="sticky top-0 bg-[#1A334C] z-10">
            <tr className="text-gray-300">
              <th className="py-1 px-2 text-center font-semibold border-r border-[#2C5680]" style={{ ...headerCellStyle, paddingTop: '5px', paddingBottom: '5px', fontFamily: TABLE_HEADER_FONT, fontSize: TABLE_HEADER_FONT_SIZE, color: TABLE_HEADER_COLOR, fontWeight: TABLE_HEADER_FONT_WEIGHT }}>{renderHeaderLabel('Symbol')}</th>
              {providerKeys.map((key, index) => (
                <th key={key} className={`py-1 px-2 text-center font-semibold ${index < providerKeys.length - 1 ? 'border-r border-[#2C5680]' : ''}`} style={{ ...headerCellStyle, paddingTop: '5px', paddingBottom: '5px', fontFamily: TABLE_HEADER_FONT, fontSize: TABLE_HEADER_FONT_SIZE, color: TABLE_HEADER_COLOR, fontWeight: TABLE_HEADER_FONT_WEIGHT }}>{renderHeaderLabel(normalizeSymbol(displayProviderName(key)))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedProviders.map((row, i) => {
              const dispSymbol = normalizeSymbol(row.Symbol);
              const rowKey = `${dispSymbol}-${i}`;
              return (
              <tr key={rowKey} className={`border-b border-[#2C5680]/55 hover:bg-[#1A334C]/50 ${i % 2 === 0 ? 'bg-[#0A1929]' : 'bg-[#102236]'}`} style={{ height: `${TABLE_BODY_ROW_HEIGHT}px` }}>
                <td className="py-1 px-2 text-white border-r border-[#2C5680] text-xs text-center" style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR, fontWeight: 'normal' }}><span className="flex items-center justify-center w-full" style={{ height: `${TABLE_BODY_CONTENT_HEIGHT}px` }}>{dispSymbol}</span></td>
                {providerKeys.map((key, index) => (
                  <td key={`${String(row.Symbol || '')}-${key}`} style={{ ...bodyCellStyle, fontFamily: TABLE_CELL_FONT, fontSize: TABLE_CELL_FONT_SIZE, color: TABLE_CELL_COLOR }} className={`py-1 px-2 text-center ${index < providerKeys.length - 1 ? 'border-r border-[#2C5680]' : ''}`}>
                      {renderSwitch(getProviderState(row, key), () => handleToggle(row, key))}
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
