"use client";

import React from "react";

export type CurrencyPairGroup = {
  label: string;
  pairs: string[];
};

type CurrencyPairSelectProps = {
  groups: CurrencyPairGroup[];
  /** Currently selected pairs (explicit list). */
  selected: string[];
  onChange: (next: string[]) => void;
  title?: string;
  width?: number | string;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  menuZIndex?: number;
};

function PairCheckbox({ checked }: Readonly<{ checked: boolean }>) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        borderRadius: 3,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: checked ? "#2C5680" : "#3A5570",
        background: checked ? "#2C5680" : "transparent",
        color: "#FFFFFF",
        fontSize: 10,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {checked ? "\u2713" : ""}
    </span>
  );
}

function CurrencyPairSelectComponent({
  groups,
  selected,
  onChange,
  title = "Currency Pair",
  width = 170,
  buttonClassName,
  buttonStyle,
  menuZIndex = 80,
}: Readonly<CurrencyPairSelectProps>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const allPairs = React.useMemo(() => groups.flatMap((g) => g.pairs), [groups]);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const isAll = allPairs.length > 0 && allPairs.every((p) => selectedSet.has(p));
  const isNone = selected.length === 0;

  const q = query.trim().toLowerCase();
  const filteredGroups = React.useMemo(() => {
    if (!q) return groups;
    return groups.map((g) => ({ ...g, pairs: g.pairs.filter((p) => p.toLowerCase().includes(q)) }));
  }, [groups, q]);

  // Reset the search when the menu closes.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Excel-style: the selection equals the pairs matching the current query, so
  // refining the search unticks anything that no longer matches.
  const handleSearchChange = (value: string) => {
    setQuery(value);
    const needle = value.trim().toLowerCase();
    if (!needle) return; // clearing the search leaves the current selection as-is
    const matches = allPairs.filter((p) => p.toLowerCase().includes(needle));
    onChange(matches);
  };

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  let triggerLabel: string;
  if (isAll) triggerLabel = "All";
  else if (isNone) triggerLabel = "None";
  else if (selected.length === 1) triggerLabel = selected[0];
  else triggerLabel = `${selected.length} pairs`;

  const togglePair = (pair: string) => {
    if (selectedSet.has(pair)) {
      onChange(selected.filter((p) => p !== pair));
    } else {
      onChange([...selected, pair]);
    }
  };

  const selectAll = () => onChange([...allPairs]);
  const deselectAll = () => onChange([]);

  const uiFont = "'Segoe UI', Arial, Helvetica, sans-serif";

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        title={title}
        className={buttonClassName ?? "custom-dropdown themed-dropdown-trigger flex items-center justify-between rounded border border-white/20 px-2 text-left"}
        style={{ width, ...buttonStyle }}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {triggerLabel}
        </span>
        <span style={{ marginLeft: 8, fontSize: 10, lineHeight: 1, flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 rounded border border-white/10 bg-[#102236] py-1 shadow-lg"
          style={{ zIndex: menuZIndex, minWidth: 360, maxHeight: 360, overflowY: "auto", fontFamily: uiFont }}
        >
          {/* All / None on one line */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 12px" }}>
            <button
              type="button"
              className="text-white hover:bg-[#1A334C]"
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}
              onClick={selectAll}
            >
              <PairCheckbox checked={isAll} />
              <span>All</span>
            </button>
            <button
              type="button"
              className="text-white hover:bg-[#1A334C]"
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}
              onClick={deselectAll}
            >
              <PairCheckbox checked={isNone} />
              <span>None</span>
            </button>
          </div>

          {/* Search: typing ticks matching pairs */}
          <div style={{ padding: "2px 12px 6px" }}>
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search pair..."
              style={{
                width: "100%",
                height: 26,
                boxSizing: "border-box",
                background: "#0D1D2F",
                border: "1px solid #263544",
                borderRadius: 4,
                color: "#FFFFFF",
                fontSize: 12,
                fontFamily: uiFont,
                padding: "0 8px",
                outline: "none",
              }}
            />
          </div>

          {/* Two columns: USD-based | Other */}
          <div style={{ display: "flex", borderTop: "1px solid #263544" }}>
            {filteredGroups.map((group, idx) => (
              <div
                key={group.label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  borderLeft: idx > 0 ? "1px solid #263544" : "none",
                }}
              >
                <div
                  style={{
                    padding: "6px 12px 2px",
                    color: "#9CA3AF",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {group.label}
                </div>
                {group.pairs.map((pair) => {
                  const checked = selectedSet.has(pair);
                  return (
                    <button
                      key={pair}
                      type="button"
                      className="block w-full text-left text-white hover:bg-[#1A334C]"
                      style={{ padding: "5px 12px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                      onClick={() => togglePair(pair)}
                    >
                      <PairCheckbox checked={checked} />
                      <span>{pair}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const CurrencyPairSelect = React.memo(CurrencyPairSelectComponent);
