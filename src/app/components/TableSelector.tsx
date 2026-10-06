import React from "react";

interface TableSelectorProps {
  index: number;
  selected: string;
  onSelect: (key: string) => void;
  onRemove: () => void;
}

const TABLES = [
  { key: 'position', title: 'Position and Price' },
  { key: 'strategy', title: 'Strategy' },
  { key: 'execution', title: 'Execution Results' },
  { key: 'risk', title: 'Risk Monitor' },
  { key: 'client-flow-pair', title: 'Client Flow Summary (pair)' },
  { key: 'client-flow-currency', title: 'Client Flow Summary (currency)' },
  { key: 'interbank-execution', title: 'Interbank Execution Summary' },
];

export function TableSelector({ index, selected, onSelect, onRemove }: TableSelectorProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <select
        value={selected}
        onChange={e => onSelect(e.target.value)}
        className="px-2 py-1 rounded bg-[#263544] text-white border border-gray-600 text-sm h-8"
      >
        {TABLES.map(table => (
          <option key={table.key} value={table.key}>{table.title}</option>
        ))}
      </select>
    </div>
  );
}
