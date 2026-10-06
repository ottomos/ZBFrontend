"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  MONTHS,
  alNoorJunTransactions,
  clientPeriodPerf,
  detections,
  namedClients,
  tierScorecards,
  type NamedClient,
} from "../mockData";

const EChartsReact = dynamic(() => import("echarts-for-react"), { ssr: false });
const UI_FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

type WhyDim = "tier" | "lifecycle" | "profitability" | "risk";
type TransactionFilter = "All" | "Spot" | "Forward";

type TierHistoryRow = {
  as_of: string;
  score: string;
  calc_tier: string;
  eff_tier: string;
  state: string;
};

const DEEPER: Record<string, { mom: [number, number]; qoq: [number, number]; ytd: [number, number]; t12: number }> = {
  "CIF-100517": { mom: [1050, 1200], qoq: [2620, 3250], ytd: [4900, 5870], t12: 9250 },
  "CIF-100856": { mom: [1110, 1200], qoq: [2910, 3360], ytd: [5400, 6270], t12: 11470 },
};

const TIER_HISTORY: Record<string, TierHistoryRow[]> = {
  "CIF-100184": [
    { as_of: "2026-04-30", score: "90", calc_tier: "Platinum", eff_tier: "Platinum", state: "Stable" },
    { as_of: "2026-05-31", score: "90", calc_tier: "Platinum", eff_tier: "Platinum", state: "Stable" },
    { as_of: "2026-06-30", score: "90", calc_tier: "Platinum", eff_tier: "Platinum", state: "Immediate downgrade alignment eff. 2026-07-01" },
  ],
  "CIF-100392": [
    { as_of: "2026-05-31", score: "70", calc_tier: "Platinum", eff_tier: "Platinum", state: "Stable" },
    { as_of: "2026-06-30", score: "70", calc_tier: "Platinum", eff_tier: "Platinum", state: "Stable" },
  ],
  "CIF-100517": [
    { as_of: "2026-05-31", score: "45", calc_tier: "Silver", eff_tier: "Silver", state: "Stable" },
    { as_of: "2026-06-30", score: "45", calc_tier: "Silver", eff_tier: "Silver", state: "Stable" },
  ],
  "CIF-100644": [
    { as_of: "2026-05-31", score: "60", calc_tier: "Gold", eff_tier: "Gold", state: "Stable" },
    { as_of: "2026-06-30", score: "60", calc_tier: "Gold", eff_tier: "Gold", state: "Stable" },
  ],
  "CIF-100731": [
    { as_of: "2026-06-30", score: "Not Available", calc_tier: "Not Available", eff_tier: "Not Available", state: "Input gate failed - only 8 Complete Months" },
  ],
  "CIF-100856": [
    { as_of: "2026-05-31", score: "70", calc_tier: "Platinum", eff_tier: "Platinum", state: "Stable" },
    { as_of: "2026-06-30", score: "70", calc_tier: "Platinum", eff_tier: "Platinum", state: "Stable" },
  ],
  "CIF-100913": [
    { as_of: "2026-05-31", score: "30", calc_tier: "Bronze", eff_tier: "Bronze", state: "Stable" },
    { as_of: "2026-06-30", score: "30", calc_tier: "Bronze", eff_tier: "Bronze", state: "Stable" },
  ],
  "CIF-101042": [
    { as_of: "2026-06-30", score: "Not Available", calc_tier: "Not Available", eff_tier: "Not Available", state: "Input gate failed - only 3 Complete Months" },
  ],
};

function fmtUSD(n: number | null): string {
  if (n === null) return "Not Available";
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtBps(n: number | null): string {
  if (n === null) return "Not Available";
  return `${n.toFixed(1)} bps`;
}

function segColor(seg: NamedClient["coverage_segment"]): string {
  if (seg === "VIP") return "#2ECC71";
  if (seg === "Institution") return "#2C6FD6";
  return "#2C5680";
}

function riskColor(value: NamedClient["risk"]): string {
  if (value === "At Risk") return "#FF4757";
  if (value === "Watch") return "#D97A2B";
  if (value === "Normal") return "#2ECC71";
  if (value === "Review") return "#2C5680";
  return "#9CA3AF";
}

function lifecycleColor(value: NamedClient["lifecycle"]): string {
  if (value === "Declining") return "#FF4757";
  if (value === "Dormant") return "#F4B23A";
  if (value === "Growing") return "#2ECC71";
  if (value === "Emerging") return "#2C5680";
  if (value === "Established") return "#2C6FD6";
  if (value === "New") return "#A78BFA";
  return "#9CA3AF";
}

function profitabilityColor(value: NamedClient["profitability"]): string {
  if (value === "Profitable") return "#2ECC71";
  if (value === "Marginal") return "#F4B23A";
  if (value === "Loss Making") return "#FF4757";
  return "#9CA3AF";
}

function coverageChipStyle(seg: NamedClient["coverage_segment"]): { bg: string; text: string; border: string } {
  if (seg === "VIP") return { bg: "#102236", text: "#2ECC71", border: "#2ECC71" };
  if (seg === "Institution") return { bg: "#102236", text: "#2C6FD6", border: "#2C6FD6" };
  return { bg: "#1A334C", text: "#D7DEE6", border: "#263544" };
}

function tierBadgeStyle(tier: NamedClient["value_tier"]): { bg: string; text: string; border: string } {
  if (tier === "Diamond") return { bg: "#102236", text: "#2C6FD6", border: "#2C6FD6" };
  if (tier === "Platinum") return { bg: "#1A334C", text: "#D7DEE6", border: "#263544" };
  if (tier === "Gold") return { bg: "#102236", text: "#F4B23A", border: "#F4B23A" };
  if (tier === "Silver") return { bg: "#102236", text: "#2C5680", border: "#2C5680" };
  if (tier === "Bronze") return { bg: "#102236", text: "#D97A2B", border: "#D97A2B" };
  return { bg: "#102236", text: "#9CA3AF", border: "#263544" };
}

function CoverageChip({ seg }: Readonly<{ seg: NamedClient["coverage_segment"] }>) {
  const style = coverageChipStyle(seg);
  return <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: style.bg, color: style.text, border: `1px solid ${style.border}`, fontFamily: UI_FONT }}>{seg}</span>;
}

function TierBadge({ tier }: Readonly<{ tier: NamedClient["value_tier"] }>) {
  const style = tierBadgeStyle(tier);
  return <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: style.bg, color: style.text, border: `1px solid ${style.border}`, fontFamily: UI_FONT }}>{tier}</span>;
}

function DataStatePill({ state, months }: Readonly<{ state: NamedClient["data_state"]; months: number }>) {
  let color = "#2ECC71";
  if (state === "Reduced History") color = "#2C5680";
  if (state === "Partial") color = "#9CA3AF";
  if (state === "Stale") color = "#F4B23A";
  return <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: "#102236", color, border: `1px solid ${color}`, fontFamily: UI_FONT }}>{state}{state !== "Complete" ? ` · ${months} mo` : ""}</span>;
}

function buildWhyRows(client: NamedClient, dim: WhyDim) {
  const scorecard = tierScorecards.find((item) => item.cif === client.cif);
  const perf = clientPeriodPerf.find((item) => item.cif === client.cif);
  const byDim: Record<WhyDim, Array<[string, string]>> = {
    tier: [
      ["T12 Eligible Volume", fmtUSD(scorecard?.t12_volume_usd ?? null)],
      ["Rolling Profitability", fmtUSD(scorecard?.rolling_profitability_usd ?? null)],
      ["Active Months", scorecard?.active_months !== null && scorecard?.active_months !== undefined ? `${scorecard.active_months} / 12` : "Not Available"],
      ["Volume Points", scorecard?.volume_points !== null && scorecard?.volume_points !== undefined ? String(scorecard.volume_points) : "Not Available"],
      ["Profitability Points", scorecard?.profitability_points !== null && scorecard?.profitability_points !== undefined ? String(scorecard.profitability_points) : "Not Available"],
      ["Activity Points", scorecard?.activity_points !== null && scorecard?.activity_points !== undefined ? String(scorecard.activity_points) : "Not Available"],
      ["Score", scorecard?.score !== null && scorecard?.score !== undefined ? String(scorecard.score) : "Not Available"],
      ["Monthly Calculated Tier", scorecard?.calculated_tier ?? "Not Available"],
      ["Effective Tier", scorecard?.effective_tier ?? "Not Available"],
      ["Data State", client.data_state],
    ],
    lifecycle: [
      ["First Trade", client.first_trade],
      ["Last Trade", client.last_trade],
      ["Age (days)", client.age_days.toLocaleString()],
      ["Days Since Activity", client.days_since_activity === 0 ? "Active (0)" : String(client.days_since_activity)],
      ["Lifecycle Stage", client.lifecycle],
      ["Complete Months", String(client.complete_months)],
      ["Data State", client.data_state],
    ],
    profitability: [
      ["Rolling Profitability", fmtUSD(client.rolling_profitability_usd)],
      ["Jun P&L", perf ? `$${perf.jun_pnl.toLocaleString()}` : "N/A"],
      ["May P&L", perf ? `$${perf.may_pnl.toLocaleString()}` : "N/A"],
      ["Profitability Status", client.profitability],
      ["Data State", client.data_state],
      ["Complete Months", String(client.complete_months)],
    ],
    risk: [
      ["Effective Tier", client.value_tier],
      ["Lifecycle Stage", client.lifecycle],
      ["Profitability", client.profitability],
      ["Risk Status", client.risk],
      ["Days Since Activity", client.days_since_activity === 0 ? "Active (0)" : String(client.days_since_activity)],
      ["Data State", client.data_state],
    ],
  };
  return byDim[dim];
}

function whyTitle(dim: WhyDim): string {
  if (dim === "tier") return "ValueTier";
  if (dim === "lifecycle") return "LifecycleStage";
  if (dim === "profitability") return "ProfitabilityStatus";
  return "RiskStatus";
}

function WhyDrawer({ client, dim, onClose }: Readonly<{ client: NamedClient; dim: WhyDim; onClose: () => void }>) {
  const rows = buildWhyRows(client, dim);
  const history = TIER_HISTORY[client.cif] ?? [];
  return (
    <>
      <button type="button" aria-label="Close details" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,25,41,0.4)", zIndex: 40, border: "none", padding: 0, margin: 0, cursor: "pointer" }} />
      <div className="drawer-slide-in" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(92vw, 500px)", background: "#102236", borderLeft: "1px solid #263544", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.25)", fontFamily: UI_FONT }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #263544" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 4 }}>WHY? · {whyTitle(dim).toUpperCase()}</div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "#E8F1FA", margin: 0, lineHeight: "22px" }}>{client.name}</h2>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, fontWeight: 500 }}>{client.cif} · As of 2026-06-30</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #263544", background: "#0D1D2F", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <CoverageChip seg={client.coverage_segment} />
            <TierBadge tier={client.value_tier} />
            <span style={{ fontSize: 12, color: riskColor(client.risk), fontWeight: 500 }}>{client.risk}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 6 }}>CONTROLLED INPUTS</div>
            <div style={{ border: "1px solid #263544", borderRadius: 8, overflow: "hidden" }}>
              {rows.map(([label, value], index) => {
                const rowBackground = index % 2 === 0 ? "#102236" : "#0D1D2F";
                const valueColor = value === "Not Available" || value === "N/A" ? "#9CA3AF" : "#E8F1FA";
                return (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: rowBackground, borderBottom: index < rows.length - 1 ? "1px solid #263544" : "none" }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 12, color: valueColor, fontWeight: 500 }}>{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {dim === "tier" && history.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 6 }}>STABILIZATION HISTORY</div>
              <div style={{ border: "1px solid #263544", borderRadius: 8, overflow: "hidden" }}>
                {history.map((row, index) => (
                  <div key={`${row.as_of}-${index}`} style={{ padding: "8px 14px", background: index % 2 === 0 ? "#102236" : "#0D1D2F", borderBottom: index < history.length - 1 ? "1px solid #263544" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#D7DEE6" }}>{row.as_of}</span>
                      <TierBadge tier={row.eff_tier as NamedClient["value_tier"]} />
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>Score {row.score} · {row.state}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {(client.data_state === "Reduced History" || client.data_state === "Partial") ? <div style={{ padding: "10px 12px", background: "#0D1D2F", borderRadius: 8, fontSize: 11, color: "#9CA3AF", lineHeight: "16px", fontWeight: 500 }}>{client.data_state} · {client.complete_months} complete months. Outputs requiring 12 months remain Not Available.</div> : null}
        </div>
        <div style={{ padding: "12px 24px", borderTop: "1px solid #263544", background: "#0D1D2F", fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>Observation only · No edit, override, approval or action controls.</div>
      </div>
    </>
  );
}

function tooltipMetricText(value: number | null | undefined, formatter: (value: number) => string): string {
  if (value === null || value === undefined) return "Not Available";
  return formatter(value);
}

function metricPointValues(index: number, perf: (typeof clientPeriodPerf)[number]): { deals: number | null; yieldValue: number | null } {
  let deals: number | null = null;
  let yieldValue: number | null = null;
  if (index === 11) {
    deals = perf.jun_deals;
    yieldValue = perf.jun_yield_bps;
  } else if (index === 10) {
    deals = perf.may_deals;
    yieldValue = perf.may_yield_bps;
  }
  return { deals, yieldValue };
}

function headerSortColors(active: boolean): { color: string; background: string } {
  if (active) return { color: "#FFFFFF", background: "#2C5680" };
  return { color: "#9CA3AF", background: "#1A334C" };
}

function deltaDisplay(delta: number | null): { text: string; color: string } {
  if (delta === null) return { text: "", color: "#9CA3AF" };
  if (delta >= 0) return { text: `+${delta.toFixed(1)}%`, color: "#2ECC71" };
  return { text: `${delta.toFixed(1)}%`, color: "#FF4757" };
}

function buildHeroCells(client: NamedClient, perf: (typeof clientPeriodPerf)[number], productData: Array<{ label: string; value: number; color: string }> | null) {
  const mayDealsText = perf.may_deals === 0 && client.days_since_activity > 0 ? "No Activity" : String(perf.may_deals);
  return [
    {
      label: "Jun Sales P&L",
      jun: perf.jun_pnl === 0 && perf.jun_deals === 0 ? "No Activity" : `$${perf.jun_pnl.toLocaleString()}`,
      may: perf.may_pnl === 0 && perf.may_deals === 0 ? "May No Activity" : `May $${perf.may_pnl.toLocaleString()}`,
    },
    {
      label: "Jun Eligible Volume",
      jun: perf.jun_volume === 0 && perf.jun_deals === 0 ? "No Activity" : fmtUSD(perf.jun_volume),
      may: perf.may_volume === 0 && perf.may_deals === 0 ? "May No Activity" : `May ${fmtUSD(perf.may_volume)}`,
    },
    {
      label: "Jun Deal Count",
      jun: perf.jun_deals === 0 && client.days_since_activity > 0 ? "No Activity" : String(perf.jun_deals),
      may: `May ${mayDealsText}`,
    },
    {
      label: "Jun Sales Yield",
      jun: fmtBps(perf.jun_yield_bps),
      may: `May ${fmtBps(perf.may_yield_bps)}`,
    },
    {
      label: "Jun Product Mix",
      jun: productData ? `${productData[0].label} / ${productData[1].label}` : "Not available",
      may: productData ? `$${productData[0].value.toLocaleString()} / $${productData[1].value.toLocaleString()}` : "No product split",
    },
  ];
}

function ClientNavigator({
  client,
  currentIndex,
  totalClients,
  selectedCif,
  selectorOpen,
  setSelectorOpen,
  navTo,
}: Readonly<{
  client: NamedClient;
  currentIndex: number;
  totalClients: number;
  selectedCif: string;
  selectorOpen: boolean;
  setSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  navTo: (index: number) => void;
}>) {
  const accent = segColor(client.coverage_segment);
  return (
    <div style={{ padding: "12px 18px 0", display: "flex", alignItems: "center", gap: 8, position: "relative", flexWrap: "wrap" }}>
      <button type="button" onClick={() => navTo(currentIndex - 1)} aria-label="Previous client" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #263544", background: "#0D1D2F", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6.5 2L3.5 5l3 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <button type="button" onClick={() => setSelectorOpen((open) => !open)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", height: 32, borderRadius: 8, cursor: "pointer", border: `1px solid ${accent}`, background: "#102236", color: "#E8F1FA", fontFamily: UI_FONT }}>
        <CoverageChip seg={client.coverage_segment} />
        <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{client.name}</span>
        {detections.some((item) => item.cif === selectedCif && item.status === "Open") ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF4757" }} /> : null}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: selectorOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "#9CA3AF" }}><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{currentIndex + 1} of {totalClients}</span>
      <button type="button" onClick={() => navTo(currentIndex + 1)} aria-label="Next client" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #263544", background: "#0D1D2F", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2L6.5 5l-3 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {selectorOpen ? (
        <div style={{ position: "absolute", top: 44, left: 18, zIndex: 20, background: "#102236", border: "1px solid #263544", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", minWidth: 320, overflow: "hidden" }}>
          {namedClients.map((item, index) => {
            const active = item.cif === selectedCif;
            const rowBg = active ? "#1A334C" : "#102236";
            return (
              <button key={item.cif} type="button" onClick={() => navTo(index)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 16px", border: "none", borderBottom: index < namedClients.length - 1 ? "1px solid #263544" : "none", background: rowBg, cursor: "pointer", fontFamily: UI_FONT, textAlign: "left" }}>
                <CoverageChip seg={item.coverage_segment} />
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#E8F1FA" : "#D7DEE6", flex: 1 }}>{item.name}</span>
                {detections.some((det) => det.cif === item.cif && det.status === "Open") ? <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF4757", flexShrink: 0 }} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SupportPanel({
  client,
  deeper,
  productData,
}: Readonly<{
  client: NamedClient;
  deeper: { mom: [number, number]; qoq: [number, number]; ytd: [number, number]; t12: number } | undefined;
  productData: Array<{ label: string; value: number; color: string }> | null;
}>) {
  if (deeper) {
    return (
      <div style={{ border: "1px solid #263544", borderRadius: 10, padding: 20, background: "#102236", display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "#E8F1FA", margin: "0 0 4px", lineHeight: "20px" }}>Period Comparison</h2>
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 14px", fontWeight: 500 }}>Sales P&L · Prior vs Current</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#263544", borderRadius: 8, overflow: "hidden", flex: 1 }}>
          {([ ["MoM", deeper.mom], ["QoQ", deeper.qoq], ["YTD", deeper.ytd], ["T12", [null, deeper.t12]] ] as Array<[string, [number | null, number]]>).map(([period, values]) => {
            const prior = values[0];
            const current = values[1];
            const delta = prior !== null ? ((current - prior) / prior) * 100 : null;
            const deltaView = deltaDisplay(delta);
            return (
              <div key={period} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#102236" }}>
                <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, width: 32 }}>{period}</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{prior !== null ? `$${prior.toLocaleString()}` : ""}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#E8F1FA" }}>${current.toLocaleString()}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: deltaView.color }}>{deltaView.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (productData) {
    const total = productData[0].value + productData[1].value;
    const leftPct = ((productData[0].value / total) * 100).toFixed(1);
    const rightPct = ((productData[1].value / total) * 100).toFixed(1);
    return (
      <div style={{ border: "1px solid #263544", borderRadius: 10, padding: 20, background: "#102236", display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "#E8F1FA", margin: "0 0 4px", lineHeight: "20px" }}>Jun Product Composition</h2>
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 16px", fontWeight: 500 }}>Sales P&L by product type</p>
        <div style={{ height: 32, borderRadius: 6, overflow: "hidden", display: "flex", border: "1px solid #263544", marginBottom: 14 }}>
          <div style={{ width: `${leftPct}%`, background: "#2ECC71", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{leftPct}%</span>
          </div>
          <div style={{ flex: 1, background: "#2C6FD6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{rightPct}%</span>
          </div>
        </div>
        {productData.map((row) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #263544" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: row.color }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "#D7DEE6" }}>{row.label}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#E8F1FA" }}>${row.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #263544", borderRadius: 10, padding: 20, background: "#102236", display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "#E8F1FA", margin: "0 0 4px", lineHeight: "20px" }}>Classification Detail</h2>
      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 14px", fontWeight: 500 }}>Coverage-effective as of 2026-06-30</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#263544", borderRadius: 8, overflow: "hidden" }}>
        {[
          ["Coverage", client.coverage_segment],
          ["Source", client.source_channel],
          ["Lifecycle", client.lifecycle],
          ["Risk", client.risk],
          ["Profitability", client.profitability],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", background: "#102236" }}>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 12, color: "#E8F1FA" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetectionContextSection({ clientDetections }: Readonly<{ clientDetections: typeof detections }>) {
  if (clientDetections.length === 0) return null;
  return (
    <div style={{ border: "1px solid #263544", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "10px 16px", background: "#1A334C", borderBottom: "1px solid #263544", fontSize: 11, fontWeight: 600, color: "#D7DEE6" }}>Detection Context — {clientDetections.length} active record{clientDetections.length > 1 ? "s" : ""}</div>
      {clientDetections.map((det, index) => {
        const accentColor = det.severity === "High" ? "#FF4757" : "#D97A2B";
        return (
          <div key={det.id} style={{ padding: "12px 16px", borderBottom: index < clientDetections.length - 1 ? "1px solid #263544" : "none", borderLeft: `3px solid ${accentColor}`, background: "#102236", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#E8F1FA" }}>{det.rule}</span>
                <span style={{ fontSize: 11, color: "#D7DEE6" }}>{det.type}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: accentColor }}>{det.severity}</span>
                {det.observation_only ? <span style={{ fontSize: 9, background: "#0D1D2F", border: "1px solid #263544", color: "#D7DEE6", padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>OBS</span> : null}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>
                {det.evidence_label}: <span style={{ fontWeight: 700, color: accentColor }}>{det.evidence_value}</span> · {det.detected_date}
              </div>
              {det.observation_only ? <div style={{ marginTop: 4, fontSize: 10, color: "#D97A2B", fontWeight: 500 }}>Observation only — must not be presented as a recommendation or opportunity.</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransactionsSection({
  showTxn,
  setShowTxn,
  txnFilter,
  setTxnFilter,
  txnSort,
  toggleSort,
  filteredTxn,
}: Readonly<{
  showTxn: boolean;
  setShowTxn: React.Dispatch<React.SetStateAction<boolean>>;
  txnFilter: TransactionFilter;
  setTxnFilter: React.Dispatch<React.SetStateAction<TransactionFilter>>;
  txnSort: { col: string; dir: "asc" | "desc" };
  toggleSort: (column: string) => void;
  filteredTxn: typeof alNoorJunTransactions;
}>) {
  return (
    <div style={{ border: "1px solid #263544", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: "#1A334C", borderBottom: showTxn ? "1px solid #263544" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E8F1FA" }}>Transaction Leg Detail — Jun 2026</span>
          <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginLeft: 10 }}>38 eligible legs · Observation only</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {showTxn ? (["All", "Spot", "Forward"] as const).map((value) => {
            const active = txnFilter === value;
            return <button key={value} type="button" onClick={() => setTxnFilter(value)} style={{ padding: "3px 10px", height: 32, borderRadius: 6, border: "1px solid", borderColor: active ? "#2C5680" : "#263544", background: active ? "#2C5680" : "#102236", color: active ? "#FFFFFF" : "#D7DEE6", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: UI_FONT }}>{value}</button>;
          }) : null}
          <button type="button" onClick={() => setShowTxn((open) => !open)} style={{ padding: "4px 12px", height: 28, borderRadius: 6, border: "1px solid #263544", background: showTxn ? "#2C5680" : "#102236", color: showTxn ? "#FFFFFF" : "#D7DEE6", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: UI_FONT }}>{showTxn ? "Collapse" : "Expand"}</button>
        </div>
      </div>
      {showTxn ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr>
                {[
                  { label: "#", col: "seq", align: "right" },
                  { label: "Txn ID", col: "txn_id", align: "left" },
                  { label: "Leg ID", col: "leg_id", align: "left" },
                  { label: "Trade Date", col: "trade_date", align: "left" },
                  { label: "Maturity", col: "maturity_date", align: "left" },
                  { label: "Product", col: "product", align: "left" },
                  { label: "Direction", col: "direction", align: "left" },
                  { label: "Pair", col: "currency_pair", align: "left" },
                  { label: "Dealt CCY", col: "dealt_currency", align: "left" },
                  { label: "USD Amount", col: "usd_amount", align: "right" },
                  { label: "Profit USD", col: "profit_usd", align: "right" },
                ].map((header) => {
                  const sortStyle = headerSortColors(txnSort.col === header.col);
                  let sortSuffix = "";
                  if (txnSort.col === header.col) sortSuffix = txnSort.dir === "asc" ? "↑" : "↓";
                  return <th key={header.col} onClick={() => toggleSort(header.col)} style={{ padding: "0 12px", height: 44, textAlign: header.align as "left" | "right", fontSize: 11, fontWeight: 500, color: sortStyle.color, background: sortStyle.background, borderBottom: "1px solid #263544", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}>{header.label} {sortSuffix}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {filteredTxn.map((row, index) => {
                const bodyBackground = index % 2 === 0 ? "#102236" : "#0D1D2F";
                const productColor = row.product === "Spot" ? "#2ECC71" : "#2C6FD6";
                return (
                  <tr key={row.leg_id} style={{ height: 44, borderBottom: index < filteredTxn.length - 1 ? "1px solid #263544" : "none", background: bodyBackground }}>
                    <td style={{ padding: "0 12px", textAlign: "right", fontSize: 11, color: "#9CA3AF" }}>{row.seq}</td>
                    <td style={{ padding: "0 12px", fontSize: 11, color: "#D7DEE6", fontWeight: 500 }}>{row.txn_id}</td>
                    <td style={{ padding: "0 12px", fontSize: 11, color: "#E8F1FA", fontWeight: 600 }}>{row.leg_id}</td>
                    <td style={{ padding: "0 12px", fontSize: 12, color: "#D7DEE6" }}>{row.trade_date}</td>
                    <td style={{ padding: "0 12px", fontSize: 12, color: "#9CA3AF" }}>{row.maturity_date}</td>
                    <td style={{ padding: "0 12px" }}><span style={{ fontSize: 11, fontWeight: 500, padding: "2px 6px", borderRadius: 4, background: "#102236", color: productColor, border: `1px solid ${productColor}` }}>{row.product}</span></td>
                    <td style={{ padding: "0 12px", fontSize: 11, color: "#9CA3AF" }}>{row.direction}</td>
                    <td style={{ padding: "0 12px", fontSize: 12, fontWeight: 600, color: "#E8F1FA" }}>{row.currency_pair}</td>
                    <td style={{ padding: "0 12px", fontSize: 11, color: "#9CA3AF" }}>{row.dealt_currency}</td>
                    <td style={{ padding: "0 12px", textAlign: "right", fontSize: 12, fontWeight: 500, color: "#E8F1FA" }}>${row.usd_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: "0 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#2ECC71" }}>${row.profit_usd.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #263544", background: "#1A334C" }}>
                <td colSpan={9} style={{ padding: "10px 12px", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Reconciliation — {filteredTxn.length} leg{filteredTxn.length !== 1 ? "s" : ""} {txnFilter !== "All" ? `(${txnFilter} filter)` : "· 38 eligible total"}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#E8F1FA" }}>${filteredTxn.reduce((sum, row) => sum + row.usd_amount, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#2ECC71" }}>${filteredTxn.reduce((sum, row) => sum + row.profit_usd, 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <div style={{ padding: "8px 16px", background: "#0D1D2F", borderTop: "1px solid #263544", fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>Observation only · No pricing, edit, amend, cancel, execute, export or customer-action controls.</div>
        </div>
      ) : null}
    </div>
  );
}

function DataStateBanner({ client }: Readonly<{ client: NamedClient }>) {
  if (client.data_state === "Complete") return null;
  let message = "";
  let color = "#9CA3AF";
  if (client.data_state === "Reduced History") {
    message = `Reduced History - ${client.complete_months} complete months. ValueTier, RiskStatus and 12-month profitability outputs remain Not Available. Pre-history months are not plotted.`;
    color = "#2C5680";
  }
  if (client.data_state === "Partial") {
    message = `Partial data - ${client.complete_months} complete month${client.complete_months !== 1 ? "s" : ""}. Withheld outputs: T12 Eligible Volume, Rolling Profitability, ValueTier, ProfitabilityStatus, RiskStatus.`;
  }
  if (client.data_state === "Stale") {
    message = "Stale - last successful refresh 2026-05-31. Effective tier, lifecycle, risk, profitability and T12 metrics reflect that calculation. Jun 2026 refresh did not complete.";
    color = "#F4B23A";
  }
  return <div style={{ padding: "10px 14px", background: "#0D1D2F", borderRadius: 8, borderLeft: `3px solid ${color}`, fontSize: 11, color, fontWeight: 500, lineHeight: "16px", marginBottom: 16, fontFamily: UI_FONT }}>{message}</div>;
}

function chartOption(client: NamedClient, perf: (typeof clientPeriodPerf)[number]) {
  const accent = segColor(client.coverage_segment);
  const labels = MONTHS.map((value) => value.replace(" 2025", " '25").replace(" 2026", " '26"));
  const pnlSeries = MONTHS.map((_, index) => client.monthly_pnl?.[index] ?? null);
  const volumeSeries = MONTHS.map((_, index) => {
    if (index === 11 && perf.jun_volume > 0) return perf.jun_volume;
    if (index === 10 && perf.may_volume > 0) return perf.may_volume;
    return null;
  });
  const maxVolume = Math.max(perf.jun_volume, perf.may_volume, 1);
  return {
    textStyle: { fontFamily: UI_FONT },
    grid: { left: 48, right: 20, top: 20, bottom: 40 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(13,29,47,0.96)",
      borderColor: "#263544",
      textStyle: { color: "#D7DEE6", fontSize: 12, fontFamily: UI_FONT },
      formatter: (params: Array<{ seriesName: string; axisValue: string; value: number | null }>) => {
        const pnl = params.find((item) => item.seriesName === "Sales P&L")?.value;
        const volume = params.find((item) => item.seriesName === "Eligible Volume")?.value;
        const index = labels.indexOf(params[0]?.axisValue ?? "");
        const pointValues = metricPointValues(index, perf);
        const pnlText = tooltipMetricText(pnl, (value) => `$${value.toLocaleString()}`);
        const volumeText = tooltipMetricText(volume, (value) => fmtUSD(value));
        const yieldText = pointValues.yieldValue === null ? "Not Available" : `${pointValues.yieldValue.toFixed(1)} bps`;
        return [
          `<b>${params[0]?.axisValue ?? ""}</b>`,
          `Sales P&L: ${pnlText}`,
          `Eligible Volume: ${volumeText}`,
          `Sales Yield: ${yieldText}`,
          pointValues.deals === null ? "" : `Deal Count: ${pointValues.deals}`,
        ].filter(Boolean).join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: "#263544" } },
      axisTick: { show: false },
      axisLabel: { color: "#9CA3AF", fontSize: 10 },
    },
    yAxis: [
      {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(44,86,128,0.12)", type: "dashed" } },
        axisLabel: { color: "#9CA3AF", fontSize: 10, formatter: (v: number) => `$${v.toLocaleString()}` },
      },
      {
        type: "value",
        show: false,
        min: 0,
        max: Math.ceil(maxVolume / 0.26),
      },
    ],
    series: [
      {
        name: "Eligible Volume",
        type: "bar",
        yAxisIndex: 1,
        barWidth: 16,
        itemStyle: { color: "#2C5680", borderRadius: [2, 2, 0, 0], opacity: 0.55 },
        data: volumeSeries,
      },
      {
        name: "Sales P&L",
        type: "line",
        smooth: true,
        connectNulls: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: accent, width: 2 },
        itemStyle: { color: accent },
        data: pnlSeries,
      },
    ],
  };
}

export default function CustomerIntelligencePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCif, setSelectedCif] = useState(namedClients[0].cif);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [whyDim, setWhyDim] = useState<WhyDim | null>(null);
  const [showTxn, setShowTxn] = useState(false);
  const [txnFilter, setTxnFilter] = useState<TransactionFilter>("All");
  const [txnSort, setTxnSort] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "seq", dir: "asc" });

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(timer);
  }, []);

  const client = namedClients.find((item) => item.cif === selectedCif) ?? namedClients[0];
  const perf = clientPeriodPerf.find((item) => item.cif === selectedCif) ?? clientPeriodPerf[0];
  const clientDetections = detections.filter((item) => item.cif === selectedCif);
  const deeper = DEEPER[selectedCif];
  const accent = segColor(client.coverage_segment);
  const currentIndex = namedClients.findIndex((item) => item.cif === selectedCif);
  const totalClients = namedClients.length;
  const productData = selectedCif === "CIF-100184" ? [
    { label: "Spot", value: 1180, color: "#2ECC71" },
    { label: "Forward", value: 800, color: "#2C6FD6" },
  ] : null;
  const heroCells = buildHeroCells(client, perf, productData);

  function navTo(index: number) {
    const target = namedClients[(index + totalClients) % totalClients];
    setSelectedCif(target.cif);
    setShowTxn(false);
    setSelectorOpen(false);
  }

  const filteredTxn = useMemo(() => {
    let rows = [...alNoorJunTransactions];
    if (txnFilter !== "All") rows = rows.filter((row) => row.product === txnFilter);
    rows.sort((left, right) => {
      const leftValue = left[txnSort.col as keyof typeof left] as string | number;
      const rightValue = right[txnSort.col as keyof typeof right] as string | number;
      if (leftValue === rightValue) return 0;
      if (txnSort.dir === "asc") return leftValue > rightValue ? 1 : -1;
      return leftValue < rightValue ? 1 : -1;
    });
    return rows;
  }, [txnFilter, txnSort]);

  function toggleSort(column: string) {
    setTxnSort((current) => ({ col: column, dir: current.col === column && current.dir === "asc" ? "desc" : "asc" }));
  }

  if (isLoading) return <div className="h-full bg-[#0A1929]" />;

  return (
    <div className="h-full overflow-auto bg-[#0A1929] px-3 pb-4 pt-2" style={{ fontFamily: UI_FONT }}>
      <div className="rounded-lg border border-[#263544] bg-[#102236]">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #263544", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "#E8F1FA", margin: 0, lineHeight: "24px" }}>Customer Intelligence</h1>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, fontWeight: 500 }}>Named priority clients · Read-only analytics · No CRM, workflow or recommendation features</p>
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>As of 2026-06-30</span>
        </div>

        <ClientNavigator client={client} currentIndex={currentIndex} totalClients={totalClients} selectedCif={selectedCif} selectorOpen={selectorOpen} setSelectorOpen={setSelectorOpen} navTo={navTo} />

        <div style={{ padding: "16px 18px 18px" }}>
          <DataStateBanner client={client} />

          <div style={{ border: "1px solid #263544", borderRadius: 10, padding: "20px", marginBottom: 16, background: "#102236", display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1A334C", border: `1px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: accent, flexShrink: 0 }}>
              {client.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}
            </div>
            <div style={{ flex: 1, minWidth: 320 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "#E8F1FA", margin: 0 }}>{client.name}</h2>
                <CoverageChip seg={client.coverage_segment} />
                <TierBadge tier={client.value_tier} />
                <DataStatePill state={client.data_state} months={client.complete_months} />
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>
                {client.cif} · Source {client.source_channel} · Coverage {client.coverage_segment} · First trade {client.first_trade} · Last trade {client.last_trade} · Age {client.age_days.toLocaleString()} days{client.days_since_activity > 0 ? ` · Dormant ${client.days_since_activity} days` : ""}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", border: "1px solid #263544", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
              {[
                { label: "T12 Volume", value: fmtUSD(client.t12_volume_usd) },
                { label: "Rolling P&L", value: fmtUSD(client.rolling_profitability_usd) },
              ].map((item, index) => (
                <div key={item.label} style={{ padding: "10px 14px", borderRight: index === 0 ? "1px solid #263544" : "none", background: "#0D1D2F", minWidth: 120 }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2, fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: item.value === "Not Available" ? "#9CA3AF" : "#E8F1FA" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-[1px] md:grid-cols-2 xl:grid-cols-5" style={{ border: "1px solid #263544", borderRadius: 10, overflow: "hidden", marginBottom: 20, background: "#263544" }}>
            {heroCells.map((cell, index) => {
              const isTextual = cell.jun === "No Activity" || cell.jun === "Not available";
              return (
                <div key={cell.label} style={{ padding: "14px 16px", background: "#102236", borderRight: index < 4 ? "1px solid #263544" : "none" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, marginBottom: 4 }}>{cell.label}</div>
                  <div style={{ fontSize: isTextual ? 14 : 20, fontWeight: 700, color: isTextual ? "#9CA3AF" : "#E8F1FA", lineHeight: "26px" }}>{cell.jun}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3, fontWeight: 500 }}>{cell.may}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3" style={{ marginBottom: 16 }}>
            <div className="min-w-0 xl:col-span-2" style={{ border: "1px solid #263544", borderRadius: 10, padding: 20, background: "#102236" }}>
              <div style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "#E8F1FA", margin: 0, lineHeight: "20px" }}>Monthly Sales Performance</h2>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0", fontWeight: 500 }}>{client.data_state === "Complete" ? "Monthly Sales P&L and Eligible Volume · Jul 2025 – Jun 2026" : `${client.complete_months} complete months · Pre-history months not plotted`}</p>
              </div>
              <EChartsReact option={chartOption(client, perf)} style={{ height: 320, width: "100%" }} />
              {client.data_state !== "Complete" ? <div style={{ marginTop: 6, fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>Gap in line = Not Available period. Pre-history months are never plotted as zero.</div> : null}
              <div style={{ marginTop: 4, fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>Eligible Volume · Jun and May only — prior months not available</div>
            </div>

            <SupportPanel client={client} deeper={deeper} productData={productData} />
          </div>

          <div className="grid grid-cols-1 gap-[1px] rounded-lg border border-[#263544] bg-[#263544] md:grid-cols-2 xl:grid-cols-4" style={{ overflow: "hidden", marginBottom: 16 }}>
            {([
              { dim: "tier", label: "VALUETIER", value: client.value_tier, color: "#2C5680" },
              { dim: "lifecycle", label: "LIFECYCLESTAGE", value: client.lifecycle, color: lifecycleColor(client.lifecycle) },
              { dim: "profitability", label: "PROFITABILITYSTATUS", value: client.profitability, color: profitabilityColor(client.profitability) },
              { dim: "risk", label: "RISKSTATUS", value: client.risk, color: riskColor(client.risk) },
            ] as Array<{ dim: WhyDim; label: string; value: string; color: string }>).map((cell) => (
              <div key={cell.dim} style={{ padding: "14px 16px", background: "#102236", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 102 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em" }}>{cell.label}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: cell.value === "Not Available" ? "#9CA3AF" : cell.color }}>{cell.value}</span>
                  <button type="button" onClick={() => setWhyDim(cell.dim)} style={{ fontSize: 10, fontWeight: 600, color: "#FFFFFF", background: "#2C5680", border: "1px solid #2C5680", borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontFamily: UI_FONT }}>
                    Why?
                  </button>
                </div>
              </div>
            ))}
          </div>

          {client.data_state === "Reduced History" ? <div style={{ padding: "10px 14px", background: "#0D1D2F", borderRadius: 8, borderLeft: "3px solid #263544", fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginBottom: 16 }}>RULE-004 (Material Growth) · Status: Not Evaluated — requires 12 complete months. Available period: {client.complete_months} months.</div> : null}

          <DetectionContextSection clientDetections={clientDetections} />

          {selectedCif === "CIF-100184" ? <TransactionsSection showTxn={showTxn} setShowTxn={setShowTxn} txnFilter={txnFilter} setTxnFilter={setTxnFilter} txnSort={txnSort} toggleSort={toggleSort} filteredTxn={filteredTxn} /> : null}
        </div>
      </div>
      {whyDim ? <WhyDrawer client={client} dim={whyDim} onClose={() => setWhyDim(null)} /> : null}
    </div>
  );
}
