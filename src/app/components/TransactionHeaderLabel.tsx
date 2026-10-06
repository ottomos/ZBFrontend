import React from 'react';

type TransactionHeaderType = 'customer' | 'internal';
type HeaderIconProps = { size?: number; strokeWidth?: number; className?: string };

function CustomerTransactionIcon({ size = 22, strokeWidth = 2.64, className }: Readonly<HeaderIconProps>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4 4.5h12v7H4zM8 12.5h12v7H8zM7 8h6M11 16h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </svg>
  );
}

function InternalTransactionIcon({ size = 22, strokeWidth = 2.64, className }: Readonly<HeaderIconProps>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="m7.5 11 5.8-4.1M7.5 13l9 3.6M15.7 7.2l2 8.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <circle cx="5.5" cy="12" r="2.25" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="15" cy="5.75" r="2.25" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="18.5" cy="17.5" r="2.25" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

const headerConfig: Record<TransactionHeaderType, { label: string; Icon: React.ComponentType<HeaderIconProps> }> = {
  customer: { label: 'Customer Transactions', Icon: CustomerTransactionIcon },
  internal: { label: 'Internal Transactions', Icon: InternalTransactionIcon },
};

export function TransactionHeaderLabel({ type }: Readonly<{ type: TransactionHeaderType }>) {
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