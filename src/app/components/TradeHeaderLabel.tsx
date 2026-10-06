import React from 'react';
import { BarChart3, ShieldCheck, Target, Zap } from 'lucide-react';

type TradeHeaderType = 'position' | 'strategy' | 'execution' | 'risk';

const headerConfig: Record<TradeHeaderType, { label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }> = {
  position: { label: 'Position and Price', Icon: BarChart3 },
  strategy: { label: 'Strategy', Icon: Target },
  execution: { label: 'Execution Results', Icon: Zap },
  risk: { label: 'Risk Monitor', Icon: ShieldCheck },
};

export function TradeHeaderLabel({ type }: Readonly<{ type: TradeHeaderType }>) {
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
      <Icon size={22} strokeWidth={2.64} className="trade-header-icon shrink-0" />
      <span className="trade-header-title">{label}</span>
    </span>
  );
}