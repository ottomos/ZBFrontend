"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Award, BarChart3, Database, FileText, Landmark, List, Percent, TrendingUp, type LucideIcon } from "lucide-react";

const EChartsReact = dynamic(() => import("echarts-for-react"), { ssr: false });

type NamedClientRow = {
  name: string;
  seg: "Corporate" | "Retail" | "VIP" | "Institution";
  jun: number;
  mom: number;
  dormant?: boolean;
};

const MONTHS = [
  "Jul 2025",
  "Aug 2025",
  "Sep 2025",
  "Oct 2025",
  "Nov 2025",
  "Dec 2025",
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
];

const MONTHLY_PNL = [4800, 5400, 5100, 6000, 5700, 6500, 6200, 7100, 7800, 7600, 8500, 9300];
const MONTHLY_VOL = [
  1478000,
  1513000,
  1490000,
  1542000,
  1583000,
  1643000,
  1645000,
  1689000,
  1636000,
  1303000,
  1330000,
  1420000,
];

const BRIDGE_STEPS = [
  { label: "Opening", value: 8500, type: "opening" as const },
  { label: "Corporate", value: 420, type: "delta" as const },
  { label: "VIP", value: 180, type: "delta" as const },
  { label: "Retail", value: 110, type: "delta" as const },
  { label: "Institution", value: 90, type: "delta" as const },
  { label: "Closing", value: 9300, type: "closing" as const },
];

const SEGMENT_BARS = [
  { seg: "Corporate", pnl: 4250 },
  { seg: "Retail", pnl: 2100 },
  { seg: "VIP", pnl: 1750 },
  { seg: "Institution", pnl: 1200 },
];

const PRODUCT = { spot: 5650, forward: 3650 };

const CCY_PAIRS = [
  { pair: "USD/KWD", pnl: 3150 },
  { pair: "EUR/USD", pnl: 2050 },
  { pair: "GBP/USD", pnl: 1300 },
  { pair: "EUR/KWD", pnl: 1050 },
  { pair: "GBP/KWD", pnl: 900 },
  { pair: "Other", pnl: 850 },
];

const APM_PERF_PALETTE = [
  "#2ECC71",
  "#FF4757",
  "#F4B23A",
  "#2C5680",
  "#A78BFA",
  "#D97A2B",
];

const CLIENT_ROWS: NamedClientRow[] = [
  { name: "Al Noor General Trading W.L.L.", seg: "Corporate", jun: 1980, mom: 480 },
  { name: "Pearl Coast Foodstuff and Logistics", seg: "VIP", jun: 1200, mom: 150 },
  { name: "National Marine Equipment & Contracting", seg: "Institution", jun: 1200, mom: 90 },
  { name: "Kuwait Integrated Technical Services", seg: "Corporate", jun: 710, mom: -90 },
  { name: "Blue Dunes Consumer Holdings W.L.L.", seg: "Corporate", jun: 300, mom: 60 },
  { name: "Crescent Medical Supplies and Services", seg: "VIP", jun: 550, mom: 30 },
  { name: "Gulf Horizon Industrial Projects Co.", seg: "Corporate", jun: 0, mom: 0, dormant: true },
  { name: "Eastern Gate Travel and Tourism", seg: "VIP", jun: 0, mom: 0, dormant: true },
];

const KPI_CARDS = [
  { title: "T12 Sales P&L", value: "$80.0K", delta: "+18.7% vs prior T12", tone: "#2ECC71" },
  { title: "Jun 2026 Sales P&L", value: "$9,300", delta: "+9.4% vs May 2026", tone: "#2ECC71" },
  { title: "Jun Eligible Volume", value: "$1.42M", delta: "+6.8% vs May 2026", tone: "#61AAD9" },
  { title: "Jun Deal Count", value: "428", delta: "+5.2% vs May 2026", tone: "#F4B23A" },
  { title: "Jun Sales Yield", value: "65.5 bps", delta: "May: 63.9 bps", tone: "#8AB4F8" },
  { title: "T12 Eligible FX Volume", value: "$18.27M", delta: "+14.2% vs prior T12", tone: "#2C6FD6" },
] as const;

type ManagerIconName = "sales-pnl" | "sales-list" | "volume" | "deals" | "yield" | "fx-volume" | "ranking" | "clients";

const managerIcons: Record<ManagerIconName, LucideIcon> = {
  "sales-pnl": BarChart3,
  "sales-list": List,
  volume: Database,
  deals: FileText,
  yield: Percent,
  "fx-volume": TrendingUp,
  ranking: Award,
  clients: Landmark,
};

const kpiIconByTitle: Record<string, ManagerIconName> = {
  "T12 Sales P&L": "sales-pnl",
  "Jun 2026 Sales P&L": "sales-list",
  "Jun Eligible Volume": "volume",
  "Jun Deal Count": "deals",
  "Jun Sales Yield": "yield",
  "T12 Eligible FX Volume": "fx-volume",
};

function ManagerIcon({ name, size }: Readonly<{ name: ManagerIconName; size: number }>) {
  const Icon = managerIcons[name];

  return <Icon aria-hidden="true" size={size} strokeWidth={1.9} className="shrink-0" />;
}

function toUsd(v: number): string {
  return `$${v.toLocaleString()}`;
}

function segmentColor(seg: string): string {
  if (seg === "Corporate") return "#2C5680";
  if (seg === "Retail") return "#F4B23A";
  if (seg === "VIP") return "#2ECC71";
  return "#2C6FD6";
}

function segmentAccent(seg: NamedClientRow["seg"]): string {
  if (seg === "Corporate") return "#61AAD9";
  if (seg === "Retail") return "#F4B23A";
  if (seg === "VIP") return "#2ECC71";
  return "#2C6FD6";
}

export default function ManagerViewPage() {
  const uiFont = "'Segoe UI', Arial, Helvetica, sans-serif";

  const trendOption = useMemo(
    () => ({
      textStyle: { fontFamily: uiFont },
      grid: { left: 42, right: 24, top: 28, bottom: 28 },
      tooltip: { trigger: "axis" },
      legend: { top: 0, right: 0, textStyle: { color: "#D7DEE6", fontSize: 11 } },
      xAxis: {
        type: "category",
        data: MONTHS,
        axisLine: { lineStyle: { color: "#365472" } },
        axisLabel: { color: "#B4C8DD", fontSize: 10 },
      },
      yAxis: [
        {
          type: "value",
          axisLine: { show: false },
          splitLine: { lineStyle: { color: "#1F3B58" } },
          axisLabel: { color: "#B4C8DD", fontSize: 10, formatter: (v: number) => `$${Math.round(v / 1000)}K` },
        },
        {
          type: "value",
          show: false,
        },
      ],
      series: [
        {
          name: "Volume",
          type: "bar",
          yAxisIndex: 1,
          barWidth: 12,
          itemStyle: { color: "#2C5680", borderRadius: [3, 3, 0, 0], opacity: 0.7 },
          data: MONTHLY_VOL,
        },
        {
          name: "PnL ($)",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color: "#D97A2B", width: 2 },
          itemStyle: { color: "#D97A2B" },
          data: MONTHLY_PNL,
        },
      ],
    }),
    [uiFont]
  );

  const waterfallOption = useMemo(
    () => ({
      textStyle: { fontFamily: uiFont },
      grid: { left: 46, right: 14, top: 28, bottom: 28 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "category",
        data: BRIDGE_STEPS.map((s) => s.label),
        axisLine: { lineStyle: { color: "#365472" } },
        axisLabel: { color: "#B4C8DD", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#1F3B58" } },
        axisLabel: { color: "#B4C8DD", fontSize: 10, formatter: (v: number) => `$${v.toLocaleString()}` },
      },
      series: [
        {
          type: "bar",
          barWidth: 30,
          data: BRIDGE_STEPS.map((s) => {
            if (s.type === "opening" || s.type === "closing") {
              return { value: s.value, itemStyle: { color: "#2C5680" } };
            }
            return {
              value: s.value,
              itemStyle: { color: s.value >= 0 ? "#2ECC71" : "#FF4757" },
            };
          }),
          label: {
            show: true,
            position: "top",
            color: "#D7DEE6",
            fontSize: 10,
            formatter: (p: { value: number }) => `$${p.value.toLocaleString()}`,
          },
        },
      ],
    }),
    [uiFont]
  );

  const segmentOption = useMemo(
    () => ({
      textStyle: { fontFamily: uiFont },
      grid: { left: 88, right: 24, top: 22, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#1F3B58" } },
        axisLabel: { color: "#B4C8DD", fontSize: 10, formatter: (v: number) => `$${Math.round(v / 1000)}K` },
      },
      yAxis: {
        type: "category",
        data: SEGMENT_BARS.map((r) => r.seg),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#D7DEE6", fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          barWidth: 18,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          data: SEGMENT_BARS.map((r) => ({
            value: r.pnl,
            itemStyle: {
              color: segmentColor(r.seg),
            },
          })),
          label: {
            show: true,
            position: "right",
            color: "#D7DEE6",
            fontSize: 10,
            formatter: (p: { value: number }) => `$${p.value.toLocaleString()}`,
          },
        },
      ],
    }),
    [uiFont]
  );

  const compositionOption = useMemo(() => {
    const spot = PRODUCT.spot;
    const forward = PRODUCT.forward;
    const total = spot + forward;
    const spotPct = Number(((spot / total) * 100).toFixed(1));
    const forwardPct = Number((100 - spotPct).toFixed(1));
    return {
      textStyle: { fontFamily: uiFont },
      grid: { left: 26, right: 18, top: 14, bottom: 24 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "value",
        max: 100,
        splitLine: { show: false },
        axisLabel: { color: "#B4C8DD", fontSize: 10, formatter: "{value}%" },
      },
      yAxis: {
        type: "category",
        data: ["Jun 2026"],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#D7DEE6", fontSize: 11 },
      },
      series: [
        {
          name: "Spot",
          type: "bar",
          stack: "share",
          itemStyle: { color: "#2ECC71", borderRadius: [4, 0, 0, 4] },
          label: { show: true, position: "inside", color: "#FFFFFF", fontSize: 11, formatter: `${spotPct}%` },
          data: [spotPct],
        },
        {
          name: "Forward",
          type: "bar",
          stack: "share",
          itemStyle: { color: "#2C6FD6", borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: "inside", color: "#FFFFFF", fontSize: 11, formatter: `${forwardPct}%` },
          data: [forwardPct],
        },
      ],
    };
  }, [uiFont]);

  const maxClientJun = Math.max(...CLIENT_ROWS.map((r) => r.jun));
  const maxClientMoM = Math.max(...CLIENT_ROWS.map((r) => Math.abs(r.mom)), 1);
  const maxPair = Math.max(...CCY_PAIRS.map((r) => r.pnl));

  return (
    <div className="h-full overflow-auto bg-[#0A1929] px-3 pb-3 pt-2" style={{ fontFamily: uiFont }}>
      <div className="rounded-lg border border-[#263544] bg-[#102236] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div style={{ color: "#E8F1FA", fontSize: 16, fontWeight: 700 }}>Manager View</div>
            <div style={{ color: "#9FB1C5", fontSize: 12 }}>
              Named priority clients + residual Corporate + Retail aggregate · As of 2026-06-30
            </div>
          </div>
          <div className="rounded border border-[#244B3A] bg-[#113326] px-2 py-1" style={{ color: "#7EE2AC", fontSize: 11, fontWeight: 600 }}>
            Mock Data · Jun 2026
          </div>
        </div>

        <div className="mb-2 rounded-md border border-[#29536A] bg-[#103042] px-3 py-2" style={{ color: "#9FE3C4", fontSize: 12, fontWeight: 500 }}>
          June Sales P&amp;L increased 9.4% versus May; Corporate contributed USD 420, VIP USD 180, Retail USD 110 and Institution USD 90.
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
          {KPI_CARDS.map((card) => (
            <div key={card.title} className="rounded-md border border-[#2A425C] bg-[#0F2033] p-2.5">
              <div className="flex items-start gap-2">
                <ManagerIcon name={kpiIconByTitle[card.title]} size={18.75} />
                <div>
                  <div style={{ color: "#BDD0E3", fontSize: 10.5 }}>{card.title}</div>
                  <div style={{ color: "#F3F8FD", fontSize: 16, fontWeight: 700, lineHeight: 1.1, marginTop: 5 }}>{card.value}</div>
                  <div style={{ color: card.tone, fontSize: 10.5, marginTop: 4 }}>{card.delta}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-12">
          <div className="rounded-md border border-[#2A425C] bg-[#0F2033] p-2 xl:col-span-6">
            <div className="flex items-center gap-2" style={{ color: "#E8F1FA", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              <ManagerIcon name="sales-pnl" size={18.75} />
              <span>12-Month Sales Performance (Jul 2025 - Jun 2026)</span>
            </div>
            <EChartsReact option={trendOption} style={{ height: 238, width: "100%" }} />
          </div>

          <div className="rounded-md border border-[#2A425C] bg-[#0F2033] p-2 xl:col-span-3">
            <div className="flex items-center gap-2" style={{ color: "#E8F1FA", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              <ManagerIcon name="sales-pnl" size={18.75} />
              <span>Period Sales P&amp;L Bridge (May - Jun 2026)</span>
            </div>
            <EChartsReact option={waterfallOption} style={{ height: 238, width: "100%" }} />
          </div>

          <div className="rounded-md border border-[#2A425C] bg-[#0F2033] p-2 xl:col-span-3">
            <div className="flex items-center gap-2" style={{ color: "#E8F1FA", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              <ManagerIcon name="sales-pnl" size={18.75} />
              <span>Jun 2026 by Coverage Segment</span>
            </div>
            <EChartsReact option={segmentOption} style={{ height: 238, width: "100%" }} />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-12">
          <div className="rounded-md border border-[#2A425C] bg-[#0F2033] p-2 xl:col-span-6">
            <div style={{ color: "#E8F1FA", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Jun 2026 Product Composition
            </div>
            <EChartsReact option={compositionOption} style={{ height: 120, width: "100%" }} />
            <div className="mt-1 flex items-center justify-between" style={{ color: "#BFD0E2", fontSize: 11 }}>
              <span>Spot {toUsd(PRODUCT.spot)}</span>
              <span>Forward {toUsd(PRODUCT.forward)}</span>
              <span style={{ color: "#E8F1FA", fontWeight: 600 }}>Total {toUsd(PRODUCT.spot + PRODUCT.forward)}</span>
            </div>
          </div>

          <div className="rounded-md border border-[#2A425C] bg-[#0F2033] p-2 xl:col-span-6">
            <div className="flex items-center gap-2" style={{ color: "#E8F1FA", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              <ManagerIcon name="ranking" size={18.75} />
              <span>Jun 2026 Currency-Pair Ranking</span>
            </div>
            <div className="space-y-2">
              {CCY_PAIRS.map((row) => (
                <div key={row.pair} className="flex items-center gap-2">
                  <div style={{ color: "#D7DEE6", fontSize: 11, width: 72 }}>{row.pair}</div>
                  <div className="h-3.5 flex-1 overflow-hidden rounded bg-[#173149]">
                    <div
                      style={{
                        width: `${(row.pnl / maxPair) * 100}%`,
                        height: "100%",
                        background:
                          row.pair === "Other"
                            ? "#829AB1"
                            : APM_PERF_PALETTE[CCY_PAIRS.findIndex((x) => x.pair === row.pair) % APM_PERF_PALETTE.length],
                        opacity: row.pair === "Other" ? 0.8 : 0.92,
                      }}
                    />
                  </div>
                  <div style={{ color: "#BFD0E2", fontSize: 11, width: 68, textAlign: "right" }}>{toUsd(row.pnl)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-md border border-[#2A425C] bg-[#0F2033] p-2">
          <div className="mb-1 flex items-center gap-2" style={{ color: "#E8F1FA", fontSize: 12, fontWeight: 600 }}>
            <ManagerIcon name="clients" size={18.75} />
            <span>Named-Client Contribution - Jun 2026 (Read-only)</span>
          </div>
          <div className="overflow-hidden rounded border border-[#2A425C]">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1A334C" }}>
                  <th style={{ color: "#CFE0F0", fontSize: 10, textAlign: "left", padding: "7px 8px" }}>Rank</th>
                  <th style={{ color: "#CFE0F0", fontSize: 10, textAlign: "left", padding: "7px 8px" }}>Client</th>
                  <th style={{ color: "#CFE0F0", fontSize: 10, textAlign: "left", padding: "7px 8px" }}>Coverage</th>
                  <th style={{ color: "#CFE0F0", fontSize: 10, textAlign: "right", padding: "7px 8px" }}>Jun P&amp;L</th>
                  <th style={{ color: "#CFE0F0", fontSize: 10, textAlign: "left", padding: "7px 8px" }}>Jun P&amp;L Bar</th>
                  <th style={{ color: "#CFE0F0", fontSize: 10, textAlign: "right", padding: "7px 8px" }}>MoM</th>
                </tr>
              </thead>
              <tbody>
                {CLIENT_ROWS.map((row, idx) => {
                  const segColor = segmentAccent(row.seg);
                  let momColor = "#8CA8C3";
                  if (row.mom > 0) momColor = "#2ECC71";
                  else if (row.mom < 0) momColor = "#FF4757";
                  let momText = "-";
                  if (row.mom !== 0) {
                    const sign = row.mom > 0 ? "+" : "";
                    momText = `${sign}${toUsd(row.mom)}`;
                  }
                  return (
                    <tr key={row.name} style={{ background: idx % 2 === 0 ? "#0F2033" : "#12283F" }}>
                      <td style={{ color: "#BFD0E2", fontSize: 10, padding: "7px 8px" }}>{idx + 1}</td>
                      <td style={{ color: "#E5EEF7", fontSize: 10, padding: "7px 8px" }}>{row.name}</td>
                      <td style={{ color: segColor, fontSize: 10, fontWeight: 700, padding: "7px 8px", whiteSpace: "nowrap" }}>
                        {row.seg}
                      </td>
                      <td style={{ color: "#E5EEF7", fontSize: 10, padding: "7px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {row.dormant ? "No activity" : toUsd(row.jun)}
                      </td>
                      <td style={{ padding: "7px 8px" }}>
                        {!row.dormant ? (
                          <div className="h-2 overflow-hidden rounded bg-[#173149]">
                            <div style={{ width: `${(row.jun / maxClientJun) * 100}%`, height: "100%", background: segColor, opacity: 0.9 }} />
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={{
                          color: momColor,
                          fontSize: 10,
                          padding: "7px 8px",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {momText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-12">
          <div className="rounded-md border border-[#2A425C] bg-[#0F2033] p-2 xl:col-span-7">
            <div style={{ color: "#E8F1FA", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Material Movements - Jun 2026</div>
            <div className="space-y-2">
              {CLIENT_ROWS.filter((r) => !r.dormant)
                .sort((a, b) => Math.abs(b.mom) - Math.abs(a.mom))
                .slice(0, 3)
                .map((row) => (
                  <div key={row.name} className="rounded border border-[#2A425C] bg-[#13263A] px-2 py-1.5">
                    <div style={{ color: "#E8F1FA", fontSize: 11, fontWeight: 600 }}>{row.name}</div>
                    <div style={{ color: "#9FB1C5", fontSize: 10 }}>
                      {row.seg} · Jun {toUsd(row.jun)} ·
                      <span style={{ color: row.mom >= 0 ? "#2ECC71" : "#FF4757", fontWeight: 700 }}>
                        {` ${row.mom >= 0 ? "+" : ""}${toUsd(row.mom)} MoM`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#173149]">
                      <div
                        style={{
                          width: `${(Math.abs(row.mom) / maxClientMoM) * 100}%`,
                          height: "100%",
                          background: row.mom >= 0 ? "#2ECC71" : "#FF4757",
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-md border border-[#2A425C] bg-[#0F2033] p-2 xl:col-span-5">
            <div style={{ color: "#E8F1FA", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Data Quality Context</div>
            <div className="space-y-1.5" style={{ color: "#BFD0E2", fontSize: 11 }}>
              <div className="flex items-center justify-between"><span>Named priority clients</span><span style={{ color: "#E8F1FA", fontWeight: 700 }}>8</span></div>
              <div className="flex items-center justify-between"><span>Active detections</span><span style={{ color: "#FF4757", fontWeight: 700 }}>4</span></div>
              <div className="flex items-center justify-between"><span>Reduced/partial data</span><span style={{ color: "#F4B23A", fontWeight: 700 }}>2</span></div>
              <div className="flex items-center justify-between"><span>Portfolio perimeter</span><span>Named + Residual + Retail</span></div>
              <div className="mt-2 rounded border border-[#2A425C] bg-[#13263A] px-2 py-1" style={{ color: "#9FB1C5", fontSize: 10 }}>
                Read-only observation. No action controls, CRM, pipeline, or pricing features.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
