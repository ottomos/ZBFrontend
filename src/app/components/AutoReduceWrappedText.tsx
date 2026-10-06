'use client';

import React from 'react';

interface AutoReduceWrappedTextProps {
  text: string;
  baseFontSize: string;
  reducedFontSize: string;
  containerHeight?: string;
  className?: string;
  style?: React.CSSProperties;
  normalMinHeight?: string;
  wrappedMinHeight?: string;
}

export function AutoReduceWrappedText({
  text,
  baseFontSize,
  reducedFontSize,
  containerHeight,
  className,
  style,
  normalMinHeight,
  wrappedMinHeight,
}: Readonly<AutoReduceWrappedTextProps>) {
  const containerRef = React.useRef<HTMLSpanElement | null>(null);
  const measureRef = React.useRef<HTMLSpanElement | null>(null);
  const [isWrapped, setIsWrapped] = React.useState(false);
  const [resolvedFontSize, setResolvedFontSize] = React.useState(baseFontSize);

  React.useLayoutEffect(() => {
    const measureWrap = () => {
      const measureEl = measureRef.current;
      if (!measureEl) return;

      const baseFontSizePx = Number.parseFloat(baseFontSize);
      const reducedFontSizePx = Number.parseFloat(reducedFontSize);
      const targetHeightPx = Number.parseFloat(containerHeight ?? normalMinHeight ?? '0');
      const expectedSingleLineHeight = Number.isFinite(baseFontSizePx) ? (baseFontSizePx * 1.05) + 1 : 16;
      let nextFontSizePx = Number.isFinite(baseFontSizePx) ? baseFontSizePx : 14;
      const minFontSizePx = Number.isFinite(reducedFontSizePx) ? reducedFontSizePx : nextFontSizePx;

      measureEl.style.fontSize = `${nextFontSizePx}px`;
      let measuredHeight = measureEl.getBoundingClientRect().height;

      while (
        Number.isFinite(targetHeightPx) &&
        targetHeightPx > 0 &&
        measuredHeight > targetHeightPx &&
        nextFontSizePx > minFontSizePx
      ) {
        nextFontSizePx = Math.max(minFontSizePx, nextFontSizePx - 0.5);
        measureEl.style.fontSize = `${nextFontSizePx}px`;
        measuredHeight = measureEl.getBoundingClientRect().height;
      }

      setIsWrapped(measuredHeight > expectedSingleLineHeight);
      setResolvedFontSize(`${nextFontSizePx}px`);
    };

    measureWrap();

    const containerEl = containerRef.current;
    if (!containerEl || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      measureWrap();
    });

    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [text, baseFontSize, reducedFontSize, containerHeight, normalMinHeight]);

  return (
    <span
      ref={containerRef}
      className={className ?? 'relative flex w-full items-center justify-center text-center'}
      style={{
        height: containerHeight,
        minHeight: isWrapped ? wrappedMinHeight ?? normalMinHeight : normalMinHeight,
        maxHeight: containerHeight ?? wrappedMinHeight ?? normalMinHeight,
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '100%',
          fontSize: resolvedFontSize,
          lineHeight: 1,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </span>
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'block',
          width: '100%',
          visibility: 'hidden',
          pointerEvents: 'none',
          fontSize: baseFontSize,
          lineHeight: 1,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </span>
    </span>
  );
}
