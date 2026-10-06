'use client';

import React from 'react';
import { ThemedDropdown } from '../../components/ThemedDropdown';
import { formatNumberWithCommas } from '../../lib/numberFormatter';
import { TABLE_BODY_ROW_HEIGHT } from '../../components/tableConfig';
import { DealerExecution, formatFeedDate, publishDealUpdate } from './dealData';

const CELL_FONT = "'Segoe UI'";
const CELL_FONT_SIZE = '14px';
const ROWS_PER_PAGE = 30;

type Align = 'left' | 'center' | 'right';

// How a column's raw value has to be read before it can be ordered. Every cell
// on this screen arrives as a string, so sorting on the displayed text alone
// puts "9" after "10" and orders timestamps by punctuation instead of by time.
type SortKind = 'text' | 'number' | 'date' | 'timestamp';

interface DealColumn {
  key: keyof DealerExecution;
  label: string;
  align: Align;
  width: number;
  sort: SortKind;
}

const COLUMNS: DealColumn[] = [
  { key: 'DealID', label: 'Deal ID', align: 'left', width: 150, sort: 'text' },
  { key: 'SystemDate', label: 'Timestamp', align: 'center', width: 200, sort: 'timestamp' },
  { key: 'Symbol', label: 'Currency Pair', align: 'center', width: 120, sort: 'text' },
  { key: 'Side', label: 'Side', align: 'center', width: 70, sort: 'text' },
  { key: 'BaseAmount', label: 'Base Amount', align: 'right', width: 120, sort: 'number' },
  { key: 'TranPrice', label: 'Tran Price', align: 'right', width: 110, sort: 'number' },
  { key: 'Price', label: 'Price', align: 'right', width: 110, sort: 'number' },
  { key: 'ValueDate', label: 'Value Date', align: 'center', width: 110, sort: 'date' },
  { key: 'CustomerID', label: 'Customer ID', align: 'center', width: 120, sort: 'text' },
  { key: 'User', label: 'User', align: 'center', width: 140, sort: 'text' },
  { key: 'PnlUsd', label: 'P/L (USD)', align: 'right', width: 100, sort: 'number' },
];

// numeric: true keeps embedded digits in order, so DealID 240101_2 lands before
// 240101_10 instead of after it.
const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// A saved amendment travels through Kafka, so the blotter keeps returning the
// stored row for a moment afterwards. The edited values are held over the top
// for this long to hide that gap. It has to outlast the targeted refetch that
// follows a publish, but stay short enough that the next full poll takes over -
// an amendment that never reached the consumer must not keep showing values the
// database does not hold.
const PENDING_EDIT_MS = 8000;

interface PendingEdit {
  CustomerID: string;
  TranPrice: string;
  until: number;
}

// Has the stored row caught up with the amendment? TranPrice is compared as a
// number because the feed returns it at the column's own precision, so "1.15445"
// and "1.1544500" are the same price.
function pendingApplied(row: DealerExecution, edit: PendingEdit): boolean {
  if (row.CustomerID !== edit.CustomerID) return false;
  const stored = Number(row.TranPrice);
  const wanted = Number(edit.TranPrice);
  if (Number.isFinite(stored) && Number.isFinite(wanted)) return stored === wanted;
  return row.TranPrice === edit.TranPrice;
}

const FILTER_OPS = ['contains', 'does not contain', 'equals', 'does not equal', '>', '<'];

const editInputStyle: React.CSSProperties = {
  backgroundColor: '#FFC312',
  color: 'black',
  border: '1px solid #FFC312',
  borderRadius: 3,
  fontFamily: CELL_FONT,
  fontSize: CELL_FONT_SIZE,
  width: '100%',
  height: '24px',
  boxSizing: 'border-box',
  padding: '2px 6px',
  textAlign: 'right',
};

// PnlUsd is optional until its source is agreed, so an absent value renders as
// an empty cell and keeps the default colour.
function pnlColor(value: number | undefined) {
  if (value === undefined) return '#FFFFFF';
  if (value > 0) return '#2ECC71';
  if (value < 0) return '#FF4757';
  return '#FFFFFF';
}

function tranPriceColor(row: DealerExecution) {
  const tran = Number(row.TranPrice);
  const price = Number(row.Price);
  if (!Number.isFinite(tran) || !Number.isFinite(price) || tran === price) return '#FFFFFF';
  return tran < price ? '#FF4757' : '#2ECC71';
}

// Deals stamped with an email show only the local part: osman@banka.com.tr -> osman.
function userLabel(value: string): string {
  return String(value ?? '').split('@')[0];
}

// The text a cell actually shows. Search and the filter panel both compare
// against this rather than the stored value, so typing what is on screen
// (01.09.2026, osman, 235,265.55) matches instead of silently finding nothing.
function cellText(row: DealerExecution, column: DealColumn): string {
  switch (column.key) {
    case 'BaseAmount':
      return formatNumberWithCommas(row.BaseAmount);
    case 'ValueDate':
      return formatFeedDate(row.ValueDate);
    case 'PnlUsd':
      return row.PnlUsd === undefined ? '' : formatNumberWithCommas(row.PnlUsd);
    case 'User':
      return userLabel(row.User);
    default:
      return String(row[column.key]);
  }
}

// Reduces a cell to something orderable, or null when it holds nothing usable
// (PnlUsd has no source yet, so every row in that column is undefined).
function sortKey(row: DealerExecution, column: DealColumn): number | string | null {
  // User is ordered by what the cell actually shows, not by the hidden domain.
  if (column.key === 'User') return userLabel(row.User) || null;

  const raw = row[column.key];
  if (raw === undefined || raw === null || raw === '') return null;

  switch (column.sort) {
    case 'number': {
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }
    case 'date': {
      // ValueDate is yyyyMMdd, which is already chronological as an integer.
      const value = Number(String(raw).replaceAll(/\D/g, ''));
      return Number.isFinite(value) ? value : null;
    }
    case 'timestamp': {
      // SystemDate is 'yyyy-MM-dd HH:mm:ss.fff'; Date.parse needs the T back.
      const value = Date.parse(String(raw).replace(' ', 'T'));
      return Number.isNaN(value) ? null : value;
    }
    default:
      return String(raw);
  }
}

// Empty cells always sink to the bottom, in both directions - otherwise a
// column of blanks compares NaN against NaN and scrambles the rows around it.
function compareRows(a: DealerExecution, b: DealerExecution, column: DealColumn, factor: number): number {
  const left = sortKey(a, column);
  const right = sortKey(b, column);
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return (left - right) * factor;
  }
  return COLLATOR.compare(String(left), String(right)) * factor;
}

export function MyDealsTable({
  deals,
  profile,
  canEdit,
  onDealUpdated,
}: Readonly<{
  deals: DealerExecution[];
  profile: string;
  canEdit: boolean;
  onDealUpdated: () => void;
}>) {
  const [rows, setRows] = React.useState<DealerExecution[]>(deals);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState<keyof DealerExecution | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [page, setPage] = React.useState(1);

  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false);
  const [filters, setFilters] = React.useState<Array<{ col: string; op: string; val: string }>>([]);
  const [filterCol, setFilterCol] = React.useState<string>(COLUMNS[0].key);
  const [filterOp, setFilterOp] = React.useState('contains');
  const [filterVal, setFilterVal] = React.useState('');
  const [filterLogic, setFilterLogic] = React.useState<'AND' | 'OR'>('AND');

  const [editId, setEditId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // Created on first use: useRef(new Map()) would build a throwaway map on every
  // render and React only ever keeps the first one.
  const pendingEditsRef = React.useRef<Map<string, PendingEdit> | null>(null);
  const [editDraft, setEditDraft] = React.useState<{ CustomerID: string; TranPrice: string }>({
    CustomerID: '',
    TranPrice: '',
  });

  // The blotter is polled, so adopt each refreshed batch - but never while a row
  // is being edited, or the draft would be wiped mid-keystroke. A just-saved
  // amendment is laid back over the top until the consumer catches up, so the
  // row does not flick back to its old values in the meantime.
  React.useEffect(() => {
    if (editId) return;
    const pending = (pendingEditsRef.current ??= new Map());
    const now = Date.now();

    // Expiring here also clears entries for rows that left the feed entirely.
    for (const [dealId, edit] of pending) {
      if (now > edit.until) pending.delete(dealId);
    }

    if (pending.size === 0) {
      setRows(deals);
      return;
    }

    setRows(
      deals.map((deal) => {
        const edit = pending.get(deal.DealID);
        if (!edit) return deal;
        if (pendingApplied(deal, edit)) {
          pending.delete(deal.DealID);
          return deal;
        }
        return { ...deal, CustomerID: edit.CustomerID, TranPrice: edit.TranPrice, Type: 'Update' };
      })
    );
  }, [deals, editId]);

  const matchesFilters = React.useCallback(
    (row: DealerExecution) => {
      if (filters.length === 0) return true;
      const results = filters.map((filter) => {
        const column = COLUMNS.find((col) => col.key === filter.col);
        if (!column) return true;
        const cell = cellText(row, column).toLowerCase();
        const value = filter.val.trim().toLowerCase();
        switch (filter.op) {
          case 'contains':
            return cell.includes(value);
          case 'does not contain':
            return !cell.includes(value);
          case 'equals':
            return cell === value;
          case 'does not equal':
            return cell !== value;
          case '>':
          case '<': {
            // Formatted text ("235,265.55") is not a number, so the ordering
            // operators run on the same key the column sorts by.
            const left = sortKey(row, column);
            if (left === null) return false;
            if (typeof left === 'number') {
              const right = Number(value.replace(',', '.'));
              if (!Number.isFinite(right)) return false;
              return filter.op === '>' ? left > right : left < right;
            }
            const order = COLLATOR.compare(left, value);
            return filter.op === '>' ? order > 0 : order < 0;
          }
          default:
            return true;
        }
      });
      return filterLogic === 'AND' ? results.every(Boolean) : results.some(Boolean);
    },
    [filters, filterLogic]
  );

  const visibleRows = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const matchesSearch =
        !term || COLUMNS.some((column) => cellText(row, column).toLowerCase().includes(term));
      return matchesSearch && matchesFilters(row);
    });

    const column = COLUMNS.find((col) => col.key === sortColumn);
    if (!column) return filtered;
    const factor = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => compareRows(a, b, column, factor));
  }, [rows, searchTerm, matchesFilters, sortColumn, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * ROWS_PER_PAGE;
  const pageRows = visibleRows.slice(pageStart, pageStart + ROWS_PER_PAGE);

  // A filter or a smaller refresh can drop the list below the page being shown;
  // snap the state back so it does not jump forward again once the rows return.
  React.useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const handleSort = (key: keyof DealerExecution) => {
    if (sortColumn === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(key);
    // Times, amounts and prices are read newest/biggest first; text is read A-Z.
    const column = COLUMNS.find((col) => col.key === key);
    setSortDirection(column && column.sort !== 'text' ? 'desc' : 'asc');
  };

  const startEdit = (row: DealerExecution) => {
    if (!canEdit) return;
    setSaveError(null);
    setEditId(row.DealID);
    setEditDraft({ CustomerID: row.CustomerID, TranPrice: row.TranPrice });
  };

  const cancelEdit = () => {
    setSaveError(null);
    setEditId(null);
  };

  // Saving publishes an Update message for the same DealID; the consumer writes
  // it over the stored row and the next poll brings the committed values back.
  const saveEdit = async () => {
    if (!canEdit || !editId || saving) return;
    const row = rows.find((item) => item.DealID === editId);
    if (!row) {
      setEditId(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await publishDealUpdate(profile, row, editDraft);
      const applied = { CustomerID: editDraft.CustomerID.trim(), TranPrice: editDraft.TranPrice.trim() };
      // Hold these values over the next few polls so the row does not fall back
      // to the stored ones while the consumer is still writing.
      pendingEditsRef.current = pendingEditsRef.current ?? new Map();
      pendingEditsRef.current.set(editId, { ...applied, until: Date.now() + PENDING_EDIT_MS });
      // Show the edit straight away so the row does not flick back to the old
      // values while the consumer catches up.
      setRows((previous) =>
        previous.map((item) =>
          item.DealID === editId ? { ...item, ...applied, Type: 'Update' } : item
        )
      );
      setEditId(null);
      onDealUpdated();
    } catch (error) {
      // Leave the row in edit mode - a silently dropped amendment is worse than
      // an obviously stuck one.
      console.error('Failed to publish deal update', error);
      setSaveError('Update could not be sent. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // The window has to travel with the current page, otherwise page 7 of 20 shows
  // "1 2 3 ... 20" and none of the buttons look selected.
  const pageButtons = React.useMemo<Array<number | 'gap'>>(() => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }
    const windowStart = Math.max(2, Math.min(currentPage - 1, pageCount - 4));
    const windowEnd = Math.min(pageCount - 1, Math.max(currentPage + 1, 5));
    const pages: Array<number | 'gap'> = [1];
    if (windowStart > 2) pages.push('gap');
    for (let index = windowStart; index <= windowEnd; index++) pages.push(index);
    if (windowEnd < pageCount - 1) pages.push('gap');
    pages.push(pageCount);
    return pages;
  }, [pageCount, currentPage]);

  return (
    <div className="trade-blue-table flex h-full min-h-0 w-full flex-col bg-[#102236] px-2 pb-1 pt-1" style={{ fontFamily: CELL_FONT }}>
      {/* Header controls */}
      <div className="table-header-controls mb-3 flex items-center" style={{ marginTop: 6 }}>
        <div className="table-header-controls-inner flex min-h-8 w-full items-center">
          <span className="pl-2 font-semibold uppercase tracking-wide text-white" style={{ fontSize: '14px' }}>Deals</span>
          <div className="ml-10 flex flex-1 items-center gap-3">
            <span className="custom-table-search-label">Search:</span>
            <input
              type="text"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              className="custom-table-search-input h-7 leading-none"
              style={{ minWidth: 240 }}
            />
          </div>
          <button
            type="button"
            className="table-header-action-btn ml-auto mr-2 inline-flex h-7 items-center gap-2 rounded border border-white/20 bg-[#142235] px-3 text-white transition-colors hover:bg-[#1f3946]"
            style={{ fontSize: '12px', fontWeight: 600, fontFamily: CELL_FONT }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export
          </button>
          <button
            type="button"
            className="table-header-icon-btn mr-2 flex h-7 w-7 items-center justify-center border-none bg-transparent p-0"
            onClick={() => setFilterPanelOpen((open) => !open)}
            title={filterPanelOpen ? 'Hide Filter Panel' : 'Show Filter Panel'}
          >
            <svg width="18" height="18" viewBox="0 0 28 28" fill={filters.length > 0 ? '#FFFFFF' : 'none'} xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 6.5C4 5.94772 4.44772 5.5 5 5.5H23C23.5523 5.5 24 5.94772 24 6.5V8.5C24 8.76522 23.8946 9.01957 23.7071 9.20711L17 15.9142V22.5C17 22.7761 16.7761 23 16.5 23H11.5C11.2239 23 11 22.7761 11 22.5V15.9142L4.29289 9.20711C4.10536 9.01957 4 8.76522 4 8.5V6.5Z"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {filterPanelOpen && (
        <div className="mb-2 flex w-full flex-col gap-2 rounded-lg bg-[#1A334C] p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="filter-panel-label" style={{ fontSize: 11, color: '#fff' }}>Col:</span>
            <ThemedDropdown
              value={filterCol}
              onChange={setFilterCol}
              minWidth={140}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={COLUMNS.map((column) => ({ value: column.key, label: column.label }))}
            />
            <span className="filter-panel-label" style={{ fontSize: 11, color: '#fff' }}>Op:</span>
            <ThemedDropdown
              value={filterOp}
              onChange={setFilterOp}
              minWidth={130}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={FILTER_OPS.map((op) => ({ value: op, label: op }))}
            />
            <span className="filter-panel-label" style={{ fontSize: 11, color: '#fff' }}>Val:</span>
            <input
              value={filterVal}
              onChange={(event) => setFilterVal(event.target.value)}
              className="filter-panel-label rounded bg-[#102236] px-2 py-1 text-white"
              style={{ minWidth: 100, fontSize: 11 }}
            />
            <div className="flex-1" />
            <button
              type="button"
              className="filter-panel-btn rounded border border-white bg-[#102236] px-2 py-1 text-xs text-white"
              style={{ minWidth: 90, fontSize: 11 }}
              onClick={() => {
                if (!filterVal) return;
                setFilters((current) => [...current, { col: filterCol, op: filterOp, val: filterVal }]);
                setFilterVal('');
                setPage(1);
              }}
            >
              Add Filter
            </button>
          </div>
          <div>
            <span className="filter-panel-label" style={{ fontSize: 11, color: '#fff' }}>Current Filters:</span>
            <ul className="mt-1 rounded bg-[#102236] p-2" style={{ minHeight: 40 }}>
              {filters.map((filter) => (
                <li key={`${filter.col}-${filter.op}-${filter.val}`} className="mb-1 flex items-center gap-2 text-white" style={{ fontSize: 11 }}>
                  <span>{filter.col} {filter.op} {filter.val}</span>
                  <button
                    type="button"
                    className="filter-panel-btn rounded border border-white bg-[#102236] px-2 py-0.5 text-white"
                    style={{ fontSize: 11 }}
                    onClick={() => setFilters((current) => current.filter((item) => item !== filter))}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {filters.length === 0 && <li className="text-gray-400" style={{ fontSize: 11 }}>No filters added.</li>}
            </ul>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, color: '#fff' }}>Logic:</span>
            <ThemedDropdown
              value={filterLogic}
              onChange={(value) => setFilterLogic(value as 'AND' | 'OR')}
              minWidth={80}
              buttonClassName="custom-dropdown themed-dropdown-trigger filter-panel-dropdown flex items-center justify-between rounded bg-[#102236] text-white px-2 py-1"
              buttonStyle={{ height: 28 }}
              optionClassName="themed-dropdown-option filter-panel-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C]"
              options={[
                { value: 'AND', label: 'AND' },
                { value: 'OR', label: 'OR' },
              ]}
            />
            <button
              type="button"
              className="filter-panel-btn rounded border border-white bg-[#102236] px-3 py-1 text-xs text-white"
              style={{ minWidth: 90, fontSize: 11 }}
              onClick={() => setFilterPanelOpen(false)}
            >
              Apply
            </button>
            <button
              type="button"
              className="filter-panel-btn rounded border border-white bg-[#102236] px-3 py-1 text-xs text-white"
              style={{ minWidth: 90, fontSize: 11 }}
              onClick={() => setFilters([])}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm" style={{ fontFamily: CELL_FONT, fontSize: CELL_FONT_SIZE }}>
          <thead className="sticky top-0 z-10 bg-[#1A334C]">
            <tr className="text-gray-300">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  className="cursor-pointer select-none border-r border-gray-600 px-2 py-1 font-bold text-white"
                  style={{ width: column.width, minWidth: column.width, textAlign: 'center', whiteSpace: 'nowrap', position: 'relative' }}
                >
                  {column.label}
                  {sortColumn === column.key && (
                    <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#aaa' }}>
                      {sortDirection === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
              {canEdit && (
                <th className="px-2 py-1 font-bold text-white" style={{ width: 110, minWidth: 110, textAlign: 'center' }}>
                  Edit
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => {
              const isEditing = editId === row.DealID;
              return (
                <tr
                  key={row.DealID}
                  className={`border-b border-gray-700 hover:bg-[#1A334C]/50 ${index % 2 === 0 ? 'bg-[#0A1929]' : 'bg-[#102236]'}`}
                  style={{ height: `${TABLE_BODY_ROW_HEIGHT}px` }}
                >
                  {COLUMNS.map((column) => {
                    if (isEditing && column.key === 'CustomerID') {
                      return (
                        <td key={column.key} className="border-r border-gray-600 px-2 py-1" style={{ width: column.width }}>
                          <input
                            type="text"
                            value={editDraft.CustomerID}
                            onChange={(event) => setEditDraft((draft) => ({ ...draft, CustomerID: event.target.value }))}
                            style={{ ...editInputStyle, textAlign: 'center' }}
                          />
                        </td>
                      );
                    }
                    if (isEditing && column.key === 'TranPrice') {
                      return (
                        <td key={column.key} className="border-r border-gray-600 px-2 py-1" style={{ width: column.width }}>
                          <input
                            type="text"
                            value={editDraft.TranPrice}
                            onChange={(event) => setEditDraft((draft) => ({ ...draft, TranPrice: event.target.value }))}
                            style={editInputStyle}
                          />
                        </td>
                      );
                    }

                    let color = '#FFFFFF';
                    if (column.key === 'PnlUsd') color = pnlColor(row.PnlUsd);
                    else if (column.key === 'TranPrice') color = tranPriceColor(row);
                    else if (column.key === 'Side') color = row.Side === 'Buy' ? '#2ECC71' : '#FF4757';

                    return (
                      <td
                        key={column.key}
                        className="border-r border-gray-600 px-2 py-1"
                        style={{ width: column.width, textAlign: column.align, color, whiteSpace: 'nowrap' }}
                      >
                        {cellText(row, column)}
                      </td>
                    );
                  })}
                  {canEdit && (
                    <td className="px-2 py-1 text-center" style={{ width: 110 }}>
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={saving}
                            style={{ fontSize: '12px', fontWeight: 600, fontFamily: CELL_FONT }}
                            className="h-[22px] w-[46px] rounded bg-[#2C5680] text-white transition-colors hover:bg-[#61AAD9] active:scale-95 disabled:opacity-50"
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            style={{ fontSize: '11px', fontWeight: 600, fontFamily: CELL_FONT }}
                            className="h-[22px] w-[46px] rounded bg-[#FF4757] text-white transition-colors hover:bg-[#d63f51] active:scale-95 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          style={{ fontSize: '12px', fontWeight: 600, fontFamily: CELL_FONT }}
                          className="h-[22px] w-[60px] rounded bg-[#2C5680] text-white transition-colors hover:bg-[#61AAD9] active:scale-95"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer / paging */}
      <div className="mt-1 flex items-center justify-between px-2 py-1 text-white/70" style={{ fontSize: '12px' }}>
        <span>
          {saveError && <span style={{ color: '#FF4757' }}>{saveError} </span>}
          {visibleRows.length === 0
            ? 'No deals to show'
            : `Showing ${pageStart + 1} to ${Math.min(pageStart + ROWS_PER_PAGE, visibleRows.length)} of ${visibleRows.length} deals`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{ fontSize: '13px', fontFamily: CELL_FONT }}
            className="h-6 w-6 rounded border border-white/15 bg-[#142235] text-white disabled:opacity-40"
          >
            ‹
          </button>
          {pageButtons.map((entry, index) =>
            entry === 'gap' ? (
              // eslint-disable-next-line react/no-array-index-key
              <span key={`gap-${index}`} className="px-1 text-white/50">…</span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => setPage(entry)}
                style={{ fontSize: '12px', fontFamily: CELL_FONT }}
                className={`h-6 min-w-6 rounded px-1 ${
                  entry === currentPage ? 'bg-[#2C5680] text-white' : 'border border-white/15 bg-[#142235] text-white/80 hover:bg-[#1f3946]'
                }`}
              >
                {entry}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
            disabled={currentPage === pageCount}
            style={{ fontSize: '13px', fontFamily: CELL_FONT }}
            className="h-6 w-6 rounded border border-white/15 bg-[#142235] text-white disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
