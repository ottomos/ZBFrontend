'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DataTable, StrategyTable, ProviderTable, RiskTable } from '../../components';
import { useConfig } from '../../context/ConfigContext';
import { kafkaPollInterval } from '../../lib/polling';

export const dynamic = 'force-dynamic';

const TABLE_POLL_MS = kafkaPollInterval(1_000);

const TABLES = [
  { key: 'position', title: 'Position and Price' },
  { key: 'strategy', title: 'Strategy' },
  { key: 'provider', title: 'Provider Settings' },
  { key: 'risk', title: 'Risk Management' },
];

export default function TablePage() {
  const { key } = useParams<{ key: string }>();
  const table = TABLES.find(t => t.key === key);
  const [rows, setRows] = useState<any[]>([]);
  const config = useConfig();

  useEffect(() => {
    if (!table || !config || !config.API_URL) return;
    
    const fetchData = async () => {
      let API_URL;
      
      if (key === 'strategy') {
        // Fetch strategy data through Next.js proxy
        API_URL = `/api/strategy`;
      } else if (key === 'provider') {
        // Fetch provider data through Next.js proxy
        API_URL = `/api/provider`;
      } else if (key === 'risk') {
        // Generate mock risk management data for now
        setRows([
          { Symbol: 'USD/TRY', MaxPosition: 5000000, CurrentExposure: 3200000, RiskLimit: 4500000, UtilizationPercent: 71.1, VaR: 45000, StressTest: 78000, RiskStatus: 'Warning' },
          { Symbol: 'EUR/USD', MaxPosition: 8000000, CurrentExposure: 2100000, RiskLimit: 7000000, UtilizationPercent: 30.0, VaR: 32000, StressTest: 52000, RiskStatus: 'Safe' },
          { Symbol: 'GBP/USD', MaxPosition: 6000000, CurrentExposure: 5800000, RiskLimit: 5500000, UtilizationPercent: 105.5, VaR: 89000, StressTest: 145000, RiskStatus: 'Critical' },
          { Symbol: 'XAU/USD', MaxPosition: 3000000, CurrentExposure: 1500000, RiskLimit: 2800000, UtilizationPercent: 53.6, VaR: 28000, StressTest: 41000, RiskStatus: 'Safe' },
          { Symbol: 'USD/JPY', MaxPosition: 7000000, CurrentExposure: 4900000, RiskLimit: 6200000, UtilizationPercent: 79.0, VaR: 67000, StressTest: 98000, RiskStatus: 'Warning' },
        ]);
        return;
      } else {
        // Fetch position data through Next.js proxy
        API_URL = `/api/table`;
      }
      
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        setRows(data.data || data);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to empty array if fetch fails
        setRows([]);
      }
    };

    fetchData();
    
    const interval = setInterval(fetchData, TABLE_POLL_MS);
    
    return () => clearInterval(interval);
  }, [key]);

  if (!table) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A1929] text-white">
        <div className="w-full p-4">
          <h1 className="text-2xl font-bold mb-4">Table not found</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A1929] text-white">
      <div className="w-full p-4">
        <h1 className="text-2xl font-bold mb-4">{table.title}</h1>
        <div className="text-sm text-gray-400 mb-2">
          Table key: {key} | Rows count: {rows.length}
        </div>
        {key === 'strategy' ? (
          <StrategyTable title={table.title} rows={rows} />
        ) : key === 'provider' ? (
          <ProviderTable title={table.title} rows={rows} />
        ) : key === 'risk' ? (
          <RiskTable title={table.title} rows={rows} />
        ) : (
          <DataTable title={table.title} rows={rows} />
        )}
      </div>
    </main>
  );
}
