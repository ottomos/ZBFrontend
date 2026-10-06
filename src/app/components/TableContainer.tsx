'use client';

import React, { useState } from 'react';

interface TableContainerProps {
  children: React.ReactNode;
  onRemove?: () => void;
  canRemove?: boolean;
}

export function TableContainer({ children }: TableContainerProps) {
  return (
    <div className="table-container relative h-full overflow-hidden">
      <div className="h-full">
        {children}
      </div>
    </div>
  );
}
