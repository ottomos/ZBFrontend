'use client';

import React from 'react';
import { formatNumberWithCommas } from '../../lib/numberFormatter';
import { SalesRate, formatFeedDate, splitPrice } from './dealData';

// Font sizes are inline (and centralised here) because globals.css sets
// `button { font-size: 9px !important }` outside Tailwind's cascade layer, so
// utility classes never win. The ratios mirror the approved mock-up:
// big figure 1.00 / head 0.60 / tail 0.53 / swap 0.57 / caption 0.53 / title 0.87.
const FONT = {
  title: 21,
  amountLabel: 15,
  amount: 17,
  switch: 15,
  sideLabel: 16,
  priceHead: 18,
  priceBig: 30,
  priceTail: 16,
  swap: 17,
  caption: 16,
};

const TODAY_BUTTON_HEIGHT = 88;
const SPOT_BUTTON_HEIGHT = 72;
// Blank space kept at the bottom of every price button so the date label can sit
// on top of it without covering any digits.
const NOTCH_CLEARANCE = 22;

interface RateCardProps {
  rate: SalesRate;
  symbols: string[];
  onSymbolChange: (symbol: string) => void;
  onDeal: (deal: { side: string; price: string; valueDate: string; baseAmount: number }) => void;
  // Dealing is a Dealer-only right; everyone else sees the prices read-only.
  canDeal: boolean;
}

// One price cell of the 2x2 rate grid. `swap` is only shown on the Today row.
function PriceButton({
  price,
  swap,
  height,
  onClick,
  disabled,
}: Readonly<{ price: string; swap?: string; height: number; onClick: () => void; disabled: boolean }>) {
  const { head, big, tail } = splitPrice(price);
  const swapValue = swap === undefined ? null : Number(swap);
  let swapColor: string;
  if (disabled) swapColor = '#4d7fa8';
  else if (swapValue !== null && swapValue < 0) swapColor = '#FF4757';
  else swapColor = '#2ECC71';
  // The leading digits ride on top of the big figure (their cap heights line up),
  // while the trailing pips stay on the big figure's baseline - as in the mock-up.
  const headLift = -Math.round((FONT.priceBig - FONT.priceHead) * 0.7);

  // Same disabled palette the Trade page uses for its restricted actions.
  const stateClass = disabled
    ? 'border-[#1a3a5c] bg-[#1a3a5c] text-[#4d7fa8] cursor-not-allowed'
    : 'border-[#2C5680] bg-[#2C5680] text-white hover:bg-[#61AAD9] active:brightness-90';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? 'Dealing is restricted to the Dealer role' : undefined}
      className={`flex w-full flex-col items-center justify-center rounded-lg border px-0.5 transition-colors ${stateClass}`}
      style={{ fontFamily: 'Segoe UI', height, paddingTop: 8, paddingBottom: NOTCH_CLEARANCE }}
    >
      <span className="flex items-baseline justify-center" style={{ lineHeight: 1 }}>
        <span style={{ fontSize: FONT.priceHead, fontWeight: 500, position: 'relative', top: headLift }}>{head}</span>
        <span style={{ fontSize: FONT.priceBig, fontWeight: 700, letterSpacing: '-0.5px' }}>{big}</span>
        <span style={{ fontSize: FONT.priceTail, fontWeight: 500 }}>{tail}</span>
      </span>
      {swap !== undefined && (
        <span
          className="mt-1 w-[85%] border-t border-white/25 pt-1"
          style={{ color: swapColor, fontSize: FONT.swap, fontWeight: 600, lineHeight: 1.1 }}
        >
          {swap}
        </span>
      )}
    </button>
  );
}

// Date label that sits over the bottom edge of a price row, reading as a notch
// cut out of the two buttons (same treatment as the mock-up). Its bottom edge
// lines up with the bottom of the buttons.
function RowNotchLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <span
      className="absolute bottom-0 left-1/2 whitespace-nowrap rounded px-3 text-white/75"
      style={{
        transform: 'translateX(-50%)',
        backgroundColor: '#0A1929',
        fontSize: FONT.caption,
        lineHeight: 1.3,
        zIndex: 5,
      }}
    >
      {children}
    </span>
  );
}

export function RateCard({ rate, symbols, onSymbolChange, onDeal, canDeal }: Readonly<RateCardProps>) {
  const [base, quote] = rate.Symbol.split('/');
  const [amountCurrency, setAmountCurrency] = React.useState<string>(base);
  const [amount, setAmount] = React.useState<string>('2000000');
  const [pairMenuOpen, setPairMenuOpen] = React.useState(false);
  const pairMenuRef = React.useRef<HTMLDivElement | null>(null);

  // Keep the switch valid when the card is pointed at another pair.
  React.useEffect(() => {
    setAmountCurrency(base);
  }, [base]);

  React.useEffect(() => {
    if (!pairMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (pairMenuRef.current && !pairMenuRef.current.contains(event.target as Node)) {
        setPairMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPairMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pairMenuOpen]);

  const baseSelected = amountCurrency === base;
  // Both captions stay in the currency picked on the switch: EUR selected reads
  // "Sell EUR" / "Buy EUR", TRY selected reads "Buy TRY" / "Sell TRY".
  // The two wordings describe the same pair of trades (selling EUR is buying TRY).
  const leftLabel = baseSelected ? `Sell ${base}` : `Buy ${quote}`;
  const rightLabel = baseSelected ? `Buy ${base}` : `Sell ${quote}`;

  // Side is always expressed against the base currency, so it follows the column
  // (left = bid = Sell base, right = ask = Buy base) and not the caption wording,
  // which flips with the switch.
  // BaseAmount must also be in the base currency, so an amount typed in the quote
  // currency is converted at the dealt price.
  const dealAt = (side: string, price: string, valueDate: string) => {
    if (!canDeal) return;
    const typed = Number(amount);
    if (!Number.isFinite(typed) || typed <= 0) return;

    const dealtPrice = Number(price);
    const baseAmount = baseSelected || !Number.isFinite(dealtPrice) || dealtPrice === 0
      ? typed
      : typed / dealtPrice;

    onDeal({ side, price, valueDate, baseAmount });
  };

  return (
    <div
      className="flex min-w-[250px] flex-col rounded-2xl border border-white/10 bg-[#0A1929] px-1.5 py-3 shadow-[0_6px_25px_rgba(0,0,0,0.55)]"
      style={{ fontFamily: 'Segoe UI' }}
    >
      {/* Currency pair - label and arrow are one button so there is no dead gap
          between them that looks clickable but is not. */}
      <div ref={pairMenuRef} className="relative mb-2 flex items-center justify-center border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setPairMenuOpen((open) => !open)}
          className="flex items-center gap-2 rounded px-3 py-1 text-white transition-colors hover:bg-[#142235]"
          aria-haspopup="menu"
          aria-expanded={pairMenuOpen}
          aria-label="Select currency pair"
        >
          <span style={{ fontSize: FONT.title, fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1.15 }}>
            {rate.Symbol}
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.6 }}>▼</span>
        </button>
        {pairMenuOpen && (
          <div
            className="absolute left-1/2 top-full z-50 mt-1 max-h-[240px] -translate-x-1/2 overflow-y-auto rounded border border-white/10 bg-[#102236] py-1 shadow-lg"
            style={{ minWidth: 170 }}
          >
            {symbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => {
                  setPairMenuOpen(false);
                  onSymbolChange(symbol);
                }}
                className={`block w-full px-3 py-1.5 text-center text-white transition-colors hover:bg-[#1A334C] ${
                  symbol === rate.Symbol ? 'bg-[#1A334C]' : ''
                }`}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>{symbol}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Amount + currency switch - both are dealing inputs, so they follow the
          same Dealer-only rule as the price buttons. */}
      <div className="mb-2 flex items-center gap-1 rounded-lg bg-[#0F1A2B] p-1">
        <span
          className="px-2"
          style={{ fontSize: FONT.amountLabel, color: canDeal ? '#BBC7D7' : '#4d7fa8' }}
        >
          Amount
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={formatNumberWithCommas(amount || '0')}
          onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
          disabled={!canDeal}
          title={canDeal ? undefined : 'Dealing is restricted to the Dealer role'}
          className={`min-w-0 flex-1 rounded border px-2 py-1 text-right ${
            canDeal
              ? 'border-white/10 bg-transparent text-white'
              : 'cursor-not-allowed border-[#1a3a5c] bg-[#1a3a5c] text-[#4d7fa8]'
          }`}
          style={{ fontSize: FONT.amount, fontWeight: 600 }}
        />
        <div className="flex shrink-0 gap-1">
          {[base, quote].map((currency) => {
            const selected = amountCurrency === currency;
            let chipClass: string;
            if (!canDeal) {
              chipClass = selected
                ? 'cursor-not-allowed border border-[#1a3a5c] bg-[#1a3a5c] text-[#4d7fa8]'
                : 'cursor-not-allowed border border-white/10 bg-[#0A1929] text-[#4d7fa8]';
            } else if (selected) {
              chipClass = 'border border-[#2C5680] bg-[#2C5680] text-white';
            } else {
              chipClass = 'border border-white/10 bg-[#0A1929] text-gray-300 hover:bg-[#142235]';
            }
            return (
            <button
              key={currency}
              type="button"
              onClick={canDeal ? () => setAmountCurrency(currency) : undefined}
              disabled={!canDeal}
              title={canDeal ? undefined : 'Dealing is restricted to the Dealer role'}
              className={`rounded px-2 py-1 transition-colors ${chipClass}`}
            >
              <span style={{ fontSize: FONT.switch, fontWeight: 600 }}>{currency}</span>
            </button>
            );
          })}
        </div>
      </div>

      {/* Sell / Buy captions follow the selected amount currency */}
      <div className="mb-1 flex items-center justify-between px-1 text-white/80" style={{ fontSize: FONT.sideLabel }}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      {/* Today row */}
      <div className="relative" style={{ marginBottom: 4 }}>
        <div className="grid grid-cols-2 gap-1">
          <PriceButton
            price={rate.TodayBid}
            swap={rate.SwapBid}
            height={TODAY_BUTTON_HEIGHT}
            disabled={!canDeal}
            onClick={() => dealAt('Sell', rate.TodayBid, rate.TodayDate)}
          />
          <PriceButton
            price={rate.TodayAsk}
            swap={rate.SwapAsk}
            height={TODAY_BUTTON_HEIGHT}
            disabled={!canDeal}
            onClick={() => dealAt('Buy', rate.TodayAsk, rate.TodayDate)}
          />
        </div>
        <RowNotchLabel>Today // {formatFeedDate(rate.TodayDate)}</RowNotchLabel>
      </div>

      {/* Spot row */}
      <div className="relative">
        <div className="grid grid-cols-2 gap-1">
          <PriceButton
            price={rate.SpotBid}
            height={SPOT_BUTTON_HEIGHT}
            disabled={!canDeal}
            onClick={() => dealAt('Sell', rate.SpotBid, rate.SpotDate)}
          />
          <PriceButton
            price={rate.SpotAsk}
            height={SPOT_BUTTON_HEIGHT}
            disabled={!canDeal}
            onClick={() => dealAt('Buy', rate.SpotAsk, rate.SpotDate)}
          />
        </div>
        <RowNotchLabel>Spot // {formatFeedDate(rate.SpotDate)}</RowNotchLabel>
      </div>
    </div>
  );
}
