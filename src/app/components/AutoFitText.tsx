'use client';

import React from 'react';

interface AutoFitTextProps {
  text: string;
  maxFontSize: number;
  minFontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders `text` on a single line, shrinking the font size until it fits the
 * available width (or reaches `minFontSize`). Used for status values such as
 * "Above Limit" that would otherwise wrap onto a second line and overlap
 * neighbouring cells.
 */
export function AutoFitText({
  text,
  maxFontSize,
  minFontSize = 9,
  fontFamily = "'Segoe UI'",
  fontWeight = 'normal',
  className,
  style,
}: AutoFitTextProps) {
  const containerRef = React.useRef<HTMLSpanElement | null>(null);
  const probeRef = React.useRef<HTMLSpanElement | null>(null);
  const [fontSize, setFontSize] = React.useState(maxFontSize);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const probe = probeRef.current;
    if (!container || !probe) return;

    let raf = 0;
    let lastFont = -1;
    const fit = () => {
      // Read refs fresh each frame: the table re-renders live data and React
      // may swap out the DOM nodes, so a stale closure element would measure a
      // detached node.
      const el = containerRef.current;
      const pr = probeRef.current;
      if (!el || !pr) return;
      const parent = el.parentElement;
      const available = parent ? parent.clientWidth : el.clientWidth;
      if (available <= 0) return;
      pr.style.fontSize = `${maxFontSize}px`;
      const natural = pr.getBoundingClientRect().width;
      if (natural <= 0) return;
      const scale = Math.min(1, (available - 1) / natural);
      const next = Math.max(minFontSize, Math.round(maxFontSize * scale * 100) / 100);
      if (next !== lastFont) {
        lastFont = next;
        setFontSize(next);
      }
    };

    // The table re-renders live data (replacing cells), which breaks
    // ResizeObserver targets. A rAF loop is cheap and always catches width
    // changes on the current DOM regardless of re-renders.
    const loop = () => {
      fit();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [text, maxFontSize, minFontSize]);

  return (
    <span
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span
        ref={probeRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontFamily,
          fontWeight,
          fontSize: `${maxFontSize}px`,
          lineHeight: 1,
        }}
      >
        {text}
      </span>
      <span
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          fontFamily,
          fontWeight,
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          maxWidth: '100%',
        }}
      >
        {text}
      </span>
    </span>
  );
}
