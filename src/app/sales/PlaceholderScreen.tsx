import React from 'react';

// Temporary stand-in for the Sales screens until the real UIs are built.
export function PlaceholderScreen({ title }: Readonly<{ title: string }>) {
  return (
    <div className="flex h-full items-center justify-center bg-[#0A1929] px-4">
      <div className="rounded-lg border border-[#263544] bg-[#102236] px-8 py-6 text-center">
        <h1 className="text-lg font-semibold text-white">{title} page</h1>
        <p className="mt-2 text-xs text-gray-400">Will be updated.</p>
      </div>
    </div>
  );
}
