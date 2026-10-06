import React from 'react';
import { BarChart3, CircleDollarSign, Database, Landmark } from 'lucide-react';

type OverviewTableType = 'client-flow-pair' | 'client-flow-currency' | 'interbank-execution' | 'position-pnl';

const headerConfig: Record<OverviewTableType, { label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }> = {
  'position-pnl': { label: 'Position and PnL', Icon: BarChart3 },
  'client-flow-pair': { label: 'Client Flow Summary (Pair)', Icon: Database },
  'interbank-execution': { label: 'Interbank Execution Summary', Icon: Landmark },
  'client-flow-currency': { label: 'Client Flow Summary (Currency)', Icon: CircleDollarSign },
};

export function OverviewTableHeaderLabel({ type }: Readonly<{ type: OverviewTableType }>) {
  const { label, Icon } = headerConfig[type];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 16,
      }}
    >
      <Icon size={22} strokeWidth={2.64} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}