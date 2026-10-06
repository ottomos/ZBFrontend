"use client";

import React from "react";

export type ThemedDropdownOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type ThemedDropdownProps = {
  value: string;
  options: ThemedDropdownOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  title?: string;
  width?: number | string;
  minWidth?: number | string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  buttonStyle?: React.CSSProperties;
  menuStyle?: React.CSSProperties;
  optionStyle?: React.CSSProperties;
  menuZIndex?: number;
  align?: "left" | "center";
};

function ThemedDropdownComponent({
  value,
  options,
  onChange,
  disabled = false,
  title,
  width,
  minWidth,
  buttonClassName,
  menuClassName,
  optionClassName,
  buttonStyle,
  menuStyle,
  optionStyle,
  menuZIndex = 80,
  align = "left",
}: Readonly<ThemedDropdownProps>) {
  const [open, setOpen] = React.useState(false);
  const [hoveredValue, setHoveredValue] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setHoveredValue(null);
    }
  }, [open]);

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? value;
  const isOverviewPeriodSelector = String(buttonClassName || "").includes("overview-period-select");

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        title={title}
        disabled={disabled}
        className={buttonClassName ?? "custom-dropdown themed-dropdown-trigger flex items-center justify-between rounded border border-white/20 px-2 text-left"}
        style={{
          width,
          minWidth,
          opacity: disabled ? 0.65 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          ...(isOverviewPeriodSelector
            ? {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 12,
                paddingRight: 12,
                lineHeight: 1,
              }
            : null),
          ...buttonStyle,
        }}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        <span
          style={{
            flex: 1,
            textAlign: align,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            ...(isOverviewPeriodSelector
              ? {
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: "100%",
                }
              : null),
          }}
        >
          {selectedLabel}
        </span>
        <span
          style={{
            marginLeft: 8,
            fontSize: 10,
            lineHeight: 1,
            flexShrink: 0,
            ...(isOverviewPeriodSelector
              ? {
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: "100%",
                }
              : null),
          }}
        >
          ▼
        </span>
      </button>
      {open && !disabled && (
        <div
          className={menuClassName ?? "absolute left-0 top-full mt-1 rounded border border-white/10 bg-[#102236] py-1 shadow-lg"}
          style={{ zIndex: menuZIndex, width: width ?? minWidth, minWidth, ...menuStyle }}
          onMouseLeave={() => setHoveredValue(null)}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            const isHovered = hoveredValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                className={optionClassName ?? "themed-dropdown-option block w-full px-3 py-1.5 text-left text-white hover:bg-[#1A334C] disabled:cursor-not-allowed disabled:text-white/50"}
                style={{
                  background: isSelected || isHovered ? "#1A334C" : "transparent",
                  textAlign: align,
                  ...optionStyle,
                }}
                onMouseEnter={() => setHoveredValue(option.value)}
                onClick={() => {
                  setOpen(false);
                  if (!option.disabled) {
                    globalThis.requestAnimationFrame(() => {
                      onChange?.(option.value);
                    });
                  }
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const ThemedDropdown = React.memo(ThemedDropdownComponent);