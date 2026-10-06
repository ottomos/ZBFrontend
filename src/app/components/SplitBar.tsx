import React, { useRef, useState } from 'react';

interface SplitBarProps {
  direction: 'vertical' | 'horizontal';
  onDrag: (delta: number) => void;
}

export const SplitBar: React.FC<SplitBarProps> = ({ direction, onDrag }) => {
  const dragging = useRef(false);
  const lastPos = useRef<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    setIsDragging(true);
    lastPos.current = direction === 'vertical' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
    globalThis.addEventListener('mousemove', handleMouseMove);
    globalThis.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging.current || lastPos.current === null) return;
    const current = direction === 'vertical' ? e.clientX : e.clientY;
    const delta = current - lastPos.current;
    lastPos.current = current;
    onDrag(delta);
  };

  const handleMouseUp = () => {
    dragging.current = false;
    setIsDragging(false);
    lastPos.current = null;
    document.body.style.cursor = '';
    globalThis.removeEventListener('mousemove', handleMouseMove);
    globalThis.removeEventListener('mouseup', handleMouseUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 20 : 8;
    if (direction === 'vertical') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onDrag(-step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onDrag(step);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onDrag(-step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onDrag(step);
    }
  };

  const isActive = isDragging || isHovered;

  return (
    <button
      type="button"
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      aria-label={direction === 'vertical' ? 'Resize columns' : 'Resize rows'}
      className={
        direction === 'vertical'
          ? 'w-full h-full cursor-col-resize transition-colors z-20 p-0 border-0'
          : 'h-full w-full cursor-row-resize transition-colors z-20 p-0 border-0'
      }
      style={{
        userSelect: 'none',
        backgroundColor: isActive ? '#2C5680' : '#1A334C',
      }}
    />
  );
};
