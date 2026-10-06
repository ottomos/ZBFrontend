'use client';

import React from 'react';
import { SplitBar } from '../../components/SplitBar';
import { usePersistedState } from '../../lib/usePersistedState';
import { kafkaPollInterval } from '../../lib/polling';
import { useEntity } from '../../context/EntityContext';
import { isDealer } from '../../types/user';
import { RateCard } from './RateCard';
import { MyDealsTable } from './MyDealsTable';
import {
  DealerExecution,
  SalesRate,
  fetchDealerExecutions,
  fetchSalesRates,
  publishDeal,
} from './dealData';

// Card grid shapes, keyed rows x cols (so '1x5' is the single row of five).
const LAYOUTS: Record<string, { rows: number; cols: number; count: number }> = {
  '1x3': { rows: 1, cols: 3, count: 3 },
  '1x4': { rows: 1, cols: 4, count: 4 },
  '1x5': { rows: 1, cols: 5, count: 5 },
  '2x3': { rows: 2, cols: 3, count: 6 },
  '2x4': { rows: 2, cols: 4, count: 8 },
  '2x5': { rows: 2, cols: 5, count: 10 },
};
const DEFAULT_LAYOUT_KEY = '1x5';

// Enough room for a full card (pair, amount row, both price rows and the
// notched date label that hangs below the last row). Kept close to the card's
// real height so no dead space is left above the blotter.
const CARD_ROW_HEIGHT = 324;
const LAYOUT_BAR_HEIGHT = 32;
const MIN_TOP_HEIGHT = 200;
const MAX_TOP_HEIGHT = 1100;

// Natural height for a given number of card rows.
function heightForRows(rows: number): number {
  return Math.min(MAX_TOP_HEIGHT, rows * CARD_ROW_HEIGHT + LAYOUT_BAR_HEIGHT);
}

// The rate feed ticks continuously; the blotter only changes when a deal is done.
const RATES_POLL_MS = kafkaPollInterval(1_000);
const DEALS_POLL_MS = 10000;

// Miniature preview of a grid shape, same idea as the Manual Trade layout picker.
// Cells are deliberately wide and short so they read as cards, not dots.
function LayoutIcon({ layoutKey }: Readonly<{ layoutKey: string }>) {
  const def = LAYOUTS[layoutKey] ?? LAYOUTS[DEFAULT_LAYOUT_KEY];
  const width = 44;
  const gap = 2;
  const colWidth = Math.floor((width - gap * (def.cols - 1)) / def.cols);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${def.cols}, ${colWidth}px)`, gap }}>
      {Array.from({ length: def.count }, (_, index) => `${layoutKey}-cell-${index}`).map((cellKey) => (
        <div key={cellKey} style={{ width: '100%', height: 5, background: '#fff', opacity: 0.92, borderRadius: 1 }} />
      ))}
    </div>
  );
}

// Dealer email stamped onto every deal (the `User` field of the payload).
// Email is preferred over username to ensure consistent format for display and tracking.
function currentUser(): string {
  try {
    const raw = globalThis.localStorage.getItem('user');
    if (!raw) return 'unknown';
    const user = JSON.parse(raw) as { username?: string; email?: string };
    return user.email || user.username || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function DealScreen() {
  const { selectedEntity } = useEntity();
  const [layoutKey, setLayoutKey] = usePersistedState<string>('ui.sales.deal.layoutKey.v2', DEFAULT_LAYOUT_KEY);
  const [topHeight, setTopHeight] = usePersistedState<number>('ui.layout.sales.deal.topHeight.v3', heightForRows(1));
  const [cardSymbols, setCardSymbols] = usePersistedState<string[]>('ui.sales.deal.cardSymbols', () => []);
  const [layoutMenuOpen, setLayoutMenuOpen] = React.useState(false);
  const layoutMenuRef = React.useRef<HTMLDivElement | null>(null);

  const layout = LAYOUTS[layoutKey] ?? LAYOUTS[DEFAULT_LAYOUT_KEY];

  const [rates, setRates] = React.useState<SalesRate[]>([]);
  const [deals, setDeals] = React.useState<DealerExecution[]>([]);
  // Only a Dealer may deal; every other role sees the same screen read-only.
  const [canDeal, setCanDeal] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = globalThis.localStorage.getItem('user');
      setCanDeal(raw ? isDealer(JSON.parse(raw)) : false);
    } catch {
      setCanDeal(false);
    }
  }, []);

  React.useEffect(() => {
    if (!layoutMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(event.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLayoutMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [layoutMenuOpen]);

  // Live rates from PanelSalesRates_<entity>.
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchSalesRates(selectedEntity);
        if (!cancelled) setRates(rows);
      } catch (error) {
        console.error('Failed to load sales rates', error);
      }
    };
    load();
    const timer = setInterval(load, RATES_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedEntity]);

  // Executed deals from sls.sel_DealerExecutions_<entity>.
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchDealerExecutions(selectedEntity);
        if (!cancelled) setDeals(rows);
      } catch (error) {
        console.error('Failed to load dealer executions', error);
      }
    };
    load();
    const timer = setInterval(load, DEALS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedEntity]);

  const symbols = React.useMemo(() => rates.map((rate) => rate.Symbol), [rates]);

  // Both dealing and blotter edits go out through Kafka, so the row only comes
  // back once the consumer has written it - re-read shortly after publishing.
  const refreshDeals = React.useCallback(() => {
    setTimeout(() => {
      fetchDealerExecutions(selectedEntity).then(setDeals).catch(() => {});
    }, 1200);
  }, [selectedEntity]);

  const rateBySymbol = React.useMemo(() => {
    const map = new Map<string, SalesRate>();
    for (const rate of rates) map.set(rate.Symbol, rate);
    return map;
  }, [rates]);

  // Top up the card list whenever the feed arrives or the layout grows. Cards the
  // user already picked are left alone; a smaller layout just hides the tail, so
  // switching back restores the previous choices.
  React.useEffect(() => {
    if (symbols.length === 0) return;
    setCardSymbols((current) => {
      if (current.length >= layout.count) return current;
      const next = [...current];
      while (next.length < layout.count) {
        next.push(symbols[next.length % symbols.length]);
      }
      return next;
    });
  }, [symbols, layout.count, setCardSymbols]);

  const handleLayoutChange = (key: string) => {
    const def = LAYOUTS[key] ?? LAYOUTS[DEFAULT_LAYOUT_KEY];
    setLayoutKey(key);
    setTopHeight(heightForRows(def.rows));
    setLayoutMenuOpen(false);
  };

  const setSymbolAt = (index: number, symbol: string) => {
    setCardSymbols((current) => current.map((value, position) => (position === index ? symbol : value)));
  };

  const handleDeal = async (
    symbol: string,
    deal: { side: string; price: string; valueDate: string; baseAmount: number }
  ) => {
    if (!canDeal) return;
    try {
      await publishDeal(selectedEntity, {
        Symbol: symbol,
        Side: deal.side,
        BaseAmount: deal.baseAmount,
        Price: deal.price,
        ValueDate: deal.valueDate,
        // The dealer assigns the counterparty afterwards - CustomerID is one of
        // the two fields the blotter allows editing.
        CustomerID: '',
        User: currentUser(),
      });
      refreshDeals();
    } catch (error) {
      console.error('Failed to publish deal', error);
    }
  };

  const visibleCards = cardSymbols.slice(0, layout.count);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0A1929]">
      {/* Top half - rate cards. Height is driven by the chosen layout; when two
          rows no longer fit the viewport the whole screen scrolls. */}
      <div className="shrink-0 px-2 pb-0 pt-2" style={{ height: topHeight }}>
        {/* Layout picker */}
        <div className="mb-1 flex items-center" ref={layoutMenuRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setLayoutMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={layoutMenuOpen}
              aria-label="Select card layout"
              className="flex items-center rounded border border-white/20 bg-[#142235] px-2 py-1 text-white transition-colors hover:bg-[#1A334C]"
            >
              <LayoutIcon layoutKey={layoutKey} />
            </button>
            {layoutMenuOpen && (
              <div className="absolute left-0 top-full z-[60] mt-1 rounded bg-[#263544] p-2 shadow-lg">
                {Object.keys(LAYOUTS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleLayoutChange(key)}
                    aria-label={key.replace('x', ' by ')}
                    className={`flex w-full items-center rounded p-1.5 transition-colors hover:bg-[#1f3946] ${
                      key === layoutKey ? 'bg-[#1A334C]' : ''
                    }`}
                  >
                    <LayoutIcon layoutKey={key} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(250px, 1fr))` }}
        >
          {visibleCards.map((symbol, index) => {
            const rate = rateBySymbol.get(symbol);
            if (!rate) return null;
            return (
              <RateCard
                key={`${symbol}-${index}`}
                rate={rate}
                symbols={symbols}
                canDeal={canDeal}
                onSymbolChange={(next) => setSymbolAt(index, next)}
                onDeal={(deal) => handleDeal(symbol, deal)}
              />
            );
          })}
        </div>
      </div>

      <div style={{ height: 6 }}>
        <SplitBar
          direction="horizontal"
          onDrag={(delta) =>
            setTopHeight((height) => Math.min(MAX_TOP_HEIGHT, Math.max(MIN_TOP_HEIGHT, height + delta)))
          }
        />
      </div>

      {/* Bottom half - executed deals */}
      <div className="min-h-[320px] flex-1">
        <MyDealsTable
          deals={deals}
          profile={selectedEntity}
          canEdit={canDeal}
          onDealUpdated={refreshDeals}
        />
      </div>
    </div>
  );
}
