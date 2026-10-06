"use client";

import React, { useEffect, useMemo, useState } from "react";

type SourceChannel = "Corporate" | "Commercial";
type CoverageSegment = "VIP" | "Institution" | "Corporate" | "Retail";
type ValueTier = "Diamond" | "Platinum" | "Gold" | "Silver" | "Bronze" | "Not Available";
type LifecycleStage = "Established" | "Growing" | "Declining" | "Dormant" | "Emerging" | "New" | "Not Available";
type RiskStatus = "Normal" | "Watch" | "At Risk" | "Review" | "Not Available";
type ProfitabilityStatus = "Profitable" | "Marginal" | "Loss Making" | "Not Available";
type DataState = "Complete" | "Reduced History" | "Partial" | "Stale";
type WhyDim = "tier" | "lifecycle" | "risk";

type NamedClient = {
  cif: string;
  name: string;
  source_channel: SourceChannel;
  coverage_segment: CoverageSegment;
  data_state: DataState;
  complete_months: number;
  value_tier: ValueTier;
  tier_score: number | null;
  lifecycle: LifecycleStage;
  risk: RiskStatus;
  profitability: ProfitabilityStatus;
  first_trade: string;
  last_trade: string;
  age_days: number;
  days_since_activity: number;
  t12_volume_usd: number | null;
  rolling_profitability_usd: number | null;
  active_months: number | null;
};

type AggregateSummary = {
  jun_pnl: number;
  jun_volume: number;
  jun_deals: number;
  jun_yield_bps: number;
  may_pnl: number;
  may_volume: number;
  may_deals: number;
  may_yield_bps: number;
  note: string;
};

type BarSegment = { label: string; count: number; color: string };

const UI_FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

const NAMED_CLIENTS: NamedClient[] = [
  {
    cif: "CIF-100184",
    name: "Al Noor General Trading W.L.L.",
    source_channel: "Corporate",
    coverage_segment: "Corporate",
    data_state: "Complete",
    complete_months: 12,
    value_tier: "Platinum",
    tier_score: 90,
    lifecycle: "Declining",
    risk: "At Risk",
    profitability: "Profitable",
    first_trade: "2018-02-14",
    last_trade: "2026-06-30",
    age_days: 3058,
    days_since_activity: 0,
    t12_volume_usd: 3920000,
    rolling_profitability_usd: 14760,
    active_months: 12,
  },
  {
    cif: "CIF-100392",
    name: "Gulf Horizon Industrial Projects Company",
    source_channel: "Corporate",
    coverage_segment: "Corporate",
    data_state: "Complete",
    complete_months: 12,
    value_tier: "Platinum",
    tier_score: 70,
    lifecycle: "Dormant",
    risk: "At Risk",
    profitability: "Profitable",
    first_trade: "2019-06-10",
    last_trade: "2026-03-12",
    age_days: 2577,
    days_since_activity: 110,
    t12_volume_usd: 2440000,
    rolling_profitability_usd: 7400,
    active_months: 9,
  },
  {
    cif: "CIF-100517",
    name: "Pearl Coast Foodstuff and Logistics",
    source_channel: "Commercial",
    coverage_segment: "VIP",
    data_state: "Stale",
    complete_months: 12,
    value_tier: "Silver",
    tier_score: 45,
    lifecycle: "Growing",
    risk: "Normal",
    profitability: "Profitable",
    first_trade: "2023-09-21",
    last_trade: "2026-06-30",
    age_days: 1013,
    days_since_activity: 0,
    t12_volume_usd: 590000,
    rolling_profitability_usd: 5900,
    active_months: 12,
  },
  {
    cif: "CIF-100644",
    name: "Kuwait Integrated Technical Services",
    source_channel: "Corporate",
    coverage_segment: "Corporate",
    data_state: "Complete",
    complete_months: 12,
    value_tier: "Gold",
    tier_score: 60,
    lifecycle: "Declining",
    risk: "At Risk",
    profitability: "Profitable",
    first_trade: "2021-01-17",
    last_trade: "2026-06-30",
    age_days: 1990,
    days_since_activity: 0,
    t12_volume_usd: 1360000,
    rolling_profitability_usd: 8320,
    active_months: 12,
  },
  {
    cif: "CIF-100731",
    name: "Blue Dunes Consumer Holdings W.L.L.",
    source_channel: "Commercial",
    coverage_segment: "Corporate",
    data_state: "Reduced History",
    complete_months: 8,
    value_tier: "Not Available",
    tier_score: null,
    lifecycle: "Emerging",
    risk: "Not Available",
    profitability: "Not Available",
    first_trade: "2025-11-01",
    last_trade: "2026-06-30",
    age_days: 241,
    days_since_activity: 0,
    t12_volume_usd: null,
    rolling_profitability_usd: null,
    active_months: 8,
  },
  {
    cif: "CIF-100856",
    name: "National Marine Equipment and Contracting",
    source_channel: "Corporate",
    coverage_segment: "Institution",
    data_state: "Complete",
    complete_months: 12,
    value_tier: "Platinum",
    tier_score: 70,
    lifecycle: "Established",
    risk: "Normal",
    profitability: "Profitable",
    first_trade: "2017-04-03",
    last_trade: "2026-06-30",
    age_days: 3375,
    days_since_activity: 0,
    t12_volume_usd: 1800000,
    rolling_profitability_usd: 11470,
    active_months: 12,
  },
  {
    cif: "CIF-100913",
    name: "Eastern Gate Travel and Tourism",
    source_channel: "Commercial",
    coverage_segment: "VIP",
    data_state: "Complete",
    complete_months: 12,
    value_tier: "Bronze",
    tier_score: 30,
    lifecycle: "Dormant",
    risk: "Watch",
    profitability: "Marginal",
    first_trade: "2024-07-15",
    last_trade: "2026-03-31",
    age_days: 715,
    days_since_activity: 91,
    t12_volume_usd: 210000,
    rolling_profitability_usd: 3370,
    active_months: 9,
  },
  {
    cif: "CIF-101042",
    name: "Crescent Medical Supplies and Services",
    source_channel: "Commercial",
    coverage_segment: "VIP",
    data_state: "Partial",
    complete_months: 3,
    value_tier: "Not Available",
    tier_score: null,
    lifecycle: "New",
    risk: "Not Available",
    profitability: "Not Available",
    first_trade: "2026-04-05",
    last_trade: "2026-06-30",
    age_days: 86,
    days_since_activity: 0,
    t12_volume_usd: null,
    rolling_profitability_usd: null,
    active_months: 3,
  },
];

const RESIDUAL_CORPORATE: AggregateSummary = {
  jun_pnl: 1260,
  jun_volume: 136000,
  jun_deals: 47,
  jun_yield_bps: 92.6,
  may_pnl: 1290,
  may_volume: 95000,
  may_deals: 42,
  may_yield_bps: 135.8,
  note: "Portfolio Corporate P&L minus sum of named Corporate clients. Customer detail not available.",
};

const RETAIL_AGGREGATE: AggregateSummary = {
  jun_pnl: 2100,
  jun_volume: 700000,
  jun_deals: 280,
  jun_yield_bps: 30.0,
  may_pnl: 1990,
  may_volume: 650000,
  may_deals: 270,
  may_yield_bps: 30.6,
  note: "Retail is aggregate-only. No customer names, numbers or individual rows are displayed.",
};

const TIER_DIST: BarSegment[] = [
  { label: "Platinum", count: 3, color: "#2C5680" },
  { label: "Gold", count: 1, color: "#F4B23A" },
  { label: "Silver", count: 1, color: "#2C6FD6" },
  { label: "Bronze", count: 1, color: "#D97A2B" },
  { label: "N/A", count: 2, color: "#263544" },
];
const LIFECYCLE_DIST: BarSegment[] = [
  { label: "Declining", count: 2, color: "#FF4757" },
  { label: "Dormant", count: 2, color: "#F4B23A" },
  { label: "Growing", count: 1, color: "#2ECC71" },
  { label: "Emerging", count: 1, color: "#2C5680" },
  { label: "Established", count: 1, color: "#2C6FD6" },
  { label: "New", count: 1, color: "#A78BFA" },
];
const PROFIT_DIST: BarSegment[] = [
  { label: "Profitable", count: 5, color: "#2ECC71" },
  { label: "Marginal", count: 1, color: "#F4B23A" },
  { label: "N/A", count: 2, color: "#263544" },
];
const RISK_DIST: BarSegment[] = [
  { label: "At Risk", count: 3, color: "#FF4757" },
  { label: "Watch", count: 1, color: "#D97A2B" },
  { label: "Normal", count: 2, color: "#2ECC71" },
  { label: "N/A", count: 2, color: "#263544" },
];

function fmtUSD(n: number | null): string {
  if (n === null) return "Not Available";
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function coverageStyle(seg: CoverageSegment): { bg: string; text: string; border: string } {
  if (seg === "VIP") return { bg: "#102236", text: "#2ECC71", border: "#2ECC71" };
  if (seg === "Institution") return { bg: "#102236", text: "#2C6FD6", border: "#2C6FD6" };
  if (seg === "Corporate") return { bg: "#1A334C", text: "#D7DEE6", border: "#263544" };
  return { bg: "#102236", text: "#9CA3AF", border: "#263544" };
}

function tierStyle(tier: ValueTier): { bg: string; text: string; border: string } {
  if (tier === "Diamond") return { bg: "#102236", text: "#2C6FD6", border: "#2C6FD6" };
  if (tier === "Platinum") return { bg: "#1A334C", text: "#D7DEE6", border: "#263544" };
  if (tier === "Gold") return { bg: "#102236", text: "#F4B23A", border: "#F4B23A" };
  if (tier === "Silver") return { bg: "#102236", text: "#2C5680", border: "#2C5680" };
  if (tier === "Bronze") return { bg: "#102236", text: "#D97A2B", border: "#D97A2B" };
  return { bg: "#102236", text: "#9CA3AF", border: "#263544" };
}

function riskStyle(risk: RiskStatus): { text: string; dot: string } {
  if (risk === "At Risk") return { text: "#FF4757", dot: "#FF4757" };
  if (risk === "Watch") return { text: "#D97A2B", dot: "#D97A2B" };
  if (risk === "Normal") return { text: "#2ECC71", dot: "#2ECC71" };
  if (risk === "Review") return { text: "#2C5680", dot: "#2C5680" };
  return { text: "#9CA3AF", dot: "#263544" };
}

function lifecycleStyle(stage: LifecycleStage): { text: string; dot: string } {
  if (stage === "Declining") return { text: "#FF4757", dot: "#FF4757" };
  if (stage === "Dormant") return { text: "#F4B23A", dot: "#F4B23A" };
  if (stage === "Growing") return { text: "#2ECC71", dot: "#2ECC71" };
  if (stage === "Emerging") return { text: "#2C5680", dot: "#2C5680" };
  if (stage === "Established") return { text: "#2C6FD6", dot: "#2C6FD6" };
  if (stage === "New") return { text: "#A78BFA", dot: "#A78BFA" };
  return { text: "#9CA3AF", dot: "#263544" };
}

function profitStyle(status: ProfitabilityStatus): { text: string; dot: string } {
  if (status === "Profitable") return { text: "#2ECC71", dot: "#2ECC71" };
  if (status === "Marginal") return { text: "#F4B23A", dot: "#F4B23A" };
  if (status === "Loss Making") return { text: "#FF4757", dot: "#FF4757" };
  return { text: "#9CA3AF", dot: "#263544" };
}

function dataStateColor(state: DataState): string {
  if (state === "Complete") return "#2ECC71";
  if (state === "Reduced History") return "#2C5680";
  if (state === "Partial") return "#9CA3AF";
  return "#F4B23A";
}

function dataStateBackground(state: DataState): string {
  if (state === "Complete") return "#102236";
  return "#1A334C";
}

function whyRows(client: NamedClient, dim: WhyDim): Array<[string, string]> {
  const byDim: Record<WhyDim, Array<[string, string]>> = {
    tier: [
      ["T12 Eligible Volume", fmtUSD(client.t12_volume_usd)],
      ["Rolling Profitability", fmtUSD(client.rolling_profitability_usd)],
      ["Active Months", client.active_months !== null ? `${client.active_months} / 12` : "Not Available"],
      ["Tier Score", client.tier_score !== null ? String(client.tier_score) : "Not Available"],
      ["Effective Tier", client.value_tier],
      ["Data State", client.data_state],
      ["Complete Months", String(client.complete_months)],
    ],
    lifecycle: [
      ["First Trade", client.first_trade],
      ["Last Trade", client.last_trade],
      ["Age (days)", client.age_days.toLocaleString()],
      ["Days Since Activity", client.days_since_activity === 0 ? "Active (0)" : String(client.days_since_activity)],
      ["Lifecycle Stage", client.lifecycle],
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

function whyReason(client: NamedClient, dim: WhyDim): string {
  if (dim === "tier") {
    if (client.value_tier === "Not Available") {
      return `Data state is ${client.data_state} with ${client.complete_months} complete months. ValueTier requires 12 complete months, so output is withheld.`;
    }
    return `Score ${client.tier_score ?? "N/A"} across volume, profitability and activity gates maps to effective tier ${client.value_tier}.`;
  }

  if (dim === "lifecycle") {
    if (client.days_since_activity > 60) {
      return `${client.days_since_activity} days since last eligible FX activity exceeds the dormancy threshold. Lifecycle stage: ${client.lifecycle}.`;
    }
    if (client.lifecycle === "Declining") {
      return `Volume and profitability trend are declining versus prior comparable period. Lifecycle stage: ${client.lifecycle}.`;
    }
    return `Behavioral pattern over available history produces lifecycle stage ${client.lifecycle}.`;
  }

  if (client.risk === "Not Available") {
    return "RiskStatus requires valid ValueTier and LifecycleStage inputs. One or more inputs are Not Available, so RiskStatus is withheld.";
  }
  if (client.risk === "At Risk") {
    return `Lifecycle ${client.lifecycle} combined with Tier ${client.value_tier} triggers At Risk. Decline or inactivity threshold is met.`;
  }
  if (client.risk === "Watch") {
    return `Lifecycle ${client.lifecycle} with ${client.days_since_activity} days since activity has reached the monitoring threshold.`;
  }
  return `No qualifying risk condition detected. RiskStatus: ${client.risk}.`;
}

function whyAccent(client: NamedClient, dim: WhyDim): string {
  if (dim === "risk") return riskStyle(client.risk).dot;
  if (dim === "lifecycle") return lifecycleStyle(client.lifecycle).dot;
  return "#2C5680";
}

function whyLabel(dim: WhyDim): string {
  if (dim === "tier") return "ValueTier";
  if (dim === "lifecycle") return "LifecycleStage";
  return "RiskStatus";
}

function TierBadge({ tier }: Readonly<{ tier: ValueTier }>) {
  const style = tierStyle(tier);
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: style.bg, color: style.text, border: `1px solid ${style.border}`, lineHeight: "16px", whiteSpace: "nowrap", fontFamily: UI_FONT }}>
      {tier}
    </span>
  );
}

function CoverageChip({ seg }: Readonly<{ seg: CoverageSegment }>) {
  const style = coverageStyle(seg);
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: style.bg, color: style.text, border: `1px solid ${style.border}`, lineHeight: "16px", whiteSpace: "nowrap", fontFamily: UI_FONT }}>
      {seg}
    </span>
  );
}

function StatusChip({ label, map }: Readonly<{ label: string; map: { text: string; dot: string } }>) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: map.text, fontWeight: 500, whiteSpace: "nowrap", fontFamily: UI_FONT }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: map.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function DataStateBadge({ state, months }: Readonly<{ state: DataState; months: number }>) {
  const color = dataStateColor(state);
  const bg = dataStateBackground(state);
  return (
    <div style={{ fontFamily: UI_FONT }}>
      <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 4, background: bg, color }}>{state}</span>
      {state !== "Complete" ? <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500, marginTop: 2 }}>{months} mo</div> : null}
    </div>
  );
}

function MicroBar({ segments, total }: Readonly<{ segments: BarSegment[]; total: number }>) {
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1, background: "#0D1D2F" }}>
      {segments.filter((s) => s.count > 0).map((segment) => (
        <div key={segment.label} style={{ flex: segment.count / total, background: segment.color, minWidth: 6 }} />
      ))}
    </div>
  );
}

function FilterPill({ label, active, onClick }: Readonly<{ label: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 10px",
        height: 30,
        borderRadius: 13,
        border: "1px solid",
        borderColor: active ? "#2C5680" : "#263544",
        background: active ? "#2C5680" : "#102236",
        color: active ? "#FFFFFF" : "#D7DEE6",
        fontSize: 11,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: UI_FONT,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function WhyDrawer({ client, dim, onClose }: Readonly<{ client: NamedClient; dim: WhyDim; onClose: () => void }>) {
  const riskMap = riskStyle(client.risk);
  const lifeMap = lifecycleStyle(client.lifecycle);
  const profitMap = profitStyle(client.profitability);
  const rows = whyRows(client, dim);
  const reason = whyReason(client, dim);
  const accent = whyAccent(client, dim);
  const dimLabel = whyLabel(dim);

  return (
    <>
      <button type="button" aria-label="Close details" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,25,41,0.4)", zIndex: 40, border: "none", padding: 0, margin: 0, cursor: "pointer" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, background: "#102236", borderLeft: "1px solid #263544", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.25)", fontFamily: UI_FONT }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #263544" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4 }}>
                WHY? · {dimLabel.toUpperCase()}
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "#E8F1FA", margin: 0, lineHeight: "22px" }}>{client.name}</h2>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, fontWeight: 500 }}>{client.cif} · As of 2026-06-30</div>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #263544", background: "#0D1D2F", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-label="Close">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            <CoverageChip seg={client.coverage_segment} />
            <TierBadge tier={client.value_tier} />
            <StatusChip label={client.risk} map={riskMap} />
            <StatusChip label={client.lifecycle} map={lifeMap} />
            <StatusChip label={client.profitability} map={profitMap} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 8 }}>DECISIVE REASON</div>
            <div style={{ padding: "10px 12px", background: "#0D1D2F", borderRadius: 8, borderLeft: `3px solid ${accent}`, fontSize: 12, color: "#D7DEE6", lineHeight: "18px" }}>
              {reason}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 8 }}>CONTROLLED INPUTS</div>
            <div style={{ border: "1px solid #263544", borderRadius: 8, overflow: "hidden" }}>
              {rows.map(([label, value], index) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: index % 2 === 0 ? "#102236" : "#0D1D2F", borderBottom: index < rows.length - 1 ? "1px solid #263544" : "none" }}>
                  <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 12, color: value === "Not Available" || value === "N/A" ? "#9CA3AF" : "#E8F1FA", fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 24px", borderTop: "1px solid #263544", background: "#0D1D2F", fontSize: 10, color: "#9CA3AF", fontWeight: 500, lineHeight: "14px" }}>
          Observation only · No edit, override, approval or action controls.
        </div>
      </div>
    </>
  );
}

export default function SegmentationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [filterCoverage, setFilterCoverage] = useState("All");
  const [filterTier, setFilterTier] = useState("All");
  const [filterLifecycle, setFilterLifecycle] = useState("All");
  const [filterRisk, setFilterRisk] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCif, setSelectedCif] = useState<string | null>(null);
  const [whyClient, setWhyClient] = useState<NamedClient | null>(null);
  const [whyDim, setWhyDim] = useState<WhyDim>("tier");

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    return NAMED_CLIENTS.filter((client) => {
      if (filterCoverage !== "All" && client.coverage_segment !== filterCoverage) return false;
      if (filterTier !== "All" && client.value_tier !== filterTier) return false;
      if (filterLifecycle !== "All" && client.lifecycle !== filterLifecycle) return false;
      if (filterRisk !== "All" && client.risk !== filterRisk) return false;
      return true;
    });
  }, [filterCoverage, filterTier, filterLifecycle, filterRisk]);

  const vipCount = NAMED_CLIENTS.filter((client) => client.coverage_segment === "VIP").length;
  const institutionCount = NAMED_CLIENTS.filter((client) => client.coverage_segment === "Institution").length;
  const corporateCount = NAMED_CLIENTS.filter((client) => client.coverage_segment === "Corporate").length;
  const total = NAMED_CLIENTS.length;
  const secondaryActive = (filterTier !== "All" ? 1 : 0) + (filterLifecycle !== "All" ? 1 : 0);
  const anyActive = filterCoverage !== "All" || filterTier !== "All" || filterLifecycle !== "All" || filterRisk !== "All";
  let filterButtonBackground = "#102236";
  if (showFilters) filterButtonBackground = "#0D1D2F";
  if (secondaryActive > 0) filterButtonBackground = "#2C5680";

  if (isLoading) {
    return <div className="h-full bg-[#0A1929]" />;
  }

  return (
    <div className="h-full overflow-auto bg-[#0A1929] px-3 pb-4 pt-2" style={{ fontFamily: UI_FONT }}>
      <div className="rounded-lg border border-[#263544] bg-[#102236]">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #263544", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "#E8F1FA", margin: 0, lineHeight: "24px" }}>
              Customer Segmentation & Classification
            </h1>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, fontWeight: 500 }}>
              Manager Coverage Segment is authoritative · Classification dimensions are independent · Observation only
            </p>
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>As of 2026-06-30</span>
        </div>

        <div style={{ padding: "14px 18px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap", paddingBottom: 10, borderBottom: "1px solid #263544" }}>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginRight: 4 }}>Portfolio perimeter:</span>
            <CoverageChip seg="VIP" />
            <span style={{ fontSize: 11, color: "#D7DEE6", fontWeight: 500 }}>Named VIP ({vipCount})</span>
            <span style={{ color: "#263544" }}>·</span>
            <CoverageChip seg="Institution" />
            <span style={{ fontSize: 11, color: "#D7DEE6", fontWeight: 500 }}>Named Institution ({institutionCount})</span>
            <span style={{ color: "#263544" }}>·</span>
            <CoverageChip seg="Corporate" />
            <span style={{ fontSize: 11, color: "#D7DEE6", fontWeight: 500 }}>Named Corporate ({corporateCount})</span>
            <span style={{ color: "#263544" }}>·</span>
            <span style={{ fontSize: 11, color: "#D7DEE6", fontWeight: 500 }}>Residual Corporate</span>
            <span style={{ fontSize: 10, color: "#9CA3AF", background: "#0D1D2F", border: "1px solid #263544", borderRadius: 4, padding: "1px 5px" }}>agg</span>
            <span style={{ color: "#263544" }}>·</span>
            <span style={{ fontSize: 11, color: "#D7DEE6", fontWeight: 500 }}>Retail</span>
            <span style={{ fontSize: 10, color: "#9CA3AF", background: "#0D1D2F", border: "1px solid #263544", borderRadius: 4, padding: "1px 5px" }}>agg-only</span>
          </div>

          <div className="grid grid-cols-1 gap-[1px] rounded-lg border border-[#263544] bg-[#263544] md:grid-cols-2 xl:grid-cols-4" style={{ overflow: "hidden", marginBottom: 16 }}>
            {[
              { title: "Effective ValueTier", dist: TIER_DIST },
              { title: "LifecycleStage", dist: LIFECYCLE_DIST },
              { title: "ProfitabilityStatus", dist: PROFIT_DIST },
              { title: "RiskStatus", dist: RISK_DIST },
            ].map((cell) => {
              const label = cell.dist.filter((segment) => segment.count > 0).map((segment) => `${segment.label} ${segment.count}`).join(" · ");
              return (
                <div key={cell.title} style={{ padding: "14px 16px", background: "#102236", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 102 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", marginBottom: 10 }}>
                      {cell.title.toUpperCase()}
                    </div>
                    <MicroBar segments={cell.dist} total={total} />
                  </div>
                  <div style={{ fontSize: 11, color: "#D7DEE6", fontWeight: 500, lineHeight: "15px", marginTop: 12 }}>{label}</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: 14, position: "relative" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, flexShrink: 0 }}>Coverage</span>
              {(["All", "VIP", "Institution", "Corporate"] as const).map((value) => (
                <FilterPill key={value} label={value} active={filterCoverage === value} onClick={() => setFilterCoverage(value)} />
              ))}
              <div style={{ width: 1, height: 18, background: "#263544", margin: "0 4px", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, flexShrink: 0 }}>Risk</span>
              {(["All", "At Risk", "Watch", "Normal"] as const).map((value) => (
                <FilterPill key={value} label={value} active={filterRisk === value} onClick={() => setFilterRisk(value)} />
              ))}
              <div style={{ width: 1, height: 18, background: "#263544", margin: "0 4px", flexShrink: 0 }} />
              <button
                onClick={() => setShowFilters((current) => !current)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 10px",
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: secondaryActive > 0 ? "#2C5680" : "#263544",
                  background: filterButtonBackground,
                  color: secondaryActive > 0 ? "#FFFFFF" : "#D7DEE6",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: UI_FONT,
                }}
              >
                Filters
                {secondaryActive > 0 ? <span style={{ fontSize: 10, fontWeight: 700, background: "#2C5680", color: "#FFFFFF", borderRadius: 4, padding: "0 4px", lineHeight: "16px" }}>{secondaryActive}</span> : null}
              </button>
              {anyActive ? (
                <button onClick={() => { setFilterCoverage("All"); setFilterTier("All"); setFilterLifecycle("All"); setFilterRisk("All"); }} style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: UI_FONT, fontWeight: 500 }}>
                  Clear all
                </button>
              ) : null}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{filtered.length} of {total} clients</span>
            </div>

            {showFilters ? (
              <div style={{ position: "absolute", top: 38, left: 0, zIndex: 20, background: "#102236", border: "1px solid #263544", borderRadius: 10, padding: "16px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", minWidth: 420 }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 8 }}>TIER</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(["All", "Platinum", "Gold", "Silver", "Bronze"] as const).map((value) => (
                      <FilterPill key={value} label={value} active={filterTier === value} onClick={() => setFilterTier(value)} />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 8 }}>LIFECYCLE</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(["All", "Declining", "Dormant", "Growing", "Established", "Emerging", "New"] as const).map((value) => (
                      <FilterPill key={value} label={value} active={filterLifecycle === value} onClick={() => setFilterLifecycle(value)} />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ border: "1px solid #263544", borderRadius: 10, overflowX: "auto", overflowY: "hidden", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
              <thead>
                <tr>
                  {[
                    { label: "Client / CIF", align: "left", minW: 300 },
                    { label: "Coverage", align: "left", minW: 110 },
                    { label: "Source", align: "left", minW: 90 },
                    { label: "Effective Tier", align: "left", minW: 120 },
                    { label: "Score", align: "right", minW: 60 },
                    { label: "Lifecycle", align: "left", minW: 110 },
                    { label: "Profitability", align: "left", minW: 110 },
                    { label: "Risk", align: "left", minW: 100 },
                    { label: "History", align: "left", minW: 110 },
                    { label: "Why?", align: "center", minW: 90 },
                  ].map((header) => (
                    <th key={header.label} style={{ padding: "0 14px", height: 42, textAlign: header.align as "left" | "right" | "center", fontSize: 11, fontWeight: 500, color: "#9FB1C5", background: "#1A334C", borderBottom: "1px solid #263544", whiteSpace: "nowrap", minWidth: header.minW }}>
                      {header.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, index) => {
                  const selected = selectedCif === client.cif;
                  let rowBackground = "#102236";
                  if (index % 2 !== 0) rowBackground = "#0A1929";
                  if (selected) rowBackground = "#1A334C";
                  return (
                    <tr
                      key={client.cif}
                      onClick={() => setSelectedCif(selected ? null : client.cif)}
                      style={{
                        height: 52,
                        cursor: "pointer",
                        background: rowBackground,
                        borderBottom: index < filtered.length - 1 ? "1px solid #263544" : "none",
                        outline: selected ? "1px solid #2ECC71" : "none",
                        outlineOffset: -1,
                      }}
                    >
                      <td style={{ padding: "0 14px", minWidth: 300 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#E8F1FA", lineHeight: "18px" }}>{client.name}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, marginTop: 1 }}>{client.cif}</div>
                      </td>
                      <td style={{ padding: "0 14px" }}><CoverageChip seg={client.coverage_segment} /></td>
                      <td style={{ padding: "0 14px", fontSize: 11, color: "#D7DEE6", fontWeight: 500 }}>{client.source_channel}</td>
                      <td style={{ padding: "0 14px" }}><TierBadge tier={client.value_tier} /></td>
                      <td style={{ padding: "0 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: client.tier_score !== null ? "#E8F1FA" : "#9CA3AF" }}>
                        {client.tier_score ?? "N/A"}
                      </td>
                      <td style={{ padding: "0 14px" }}><StatusChip label={client.lifecycle} map={lifecycleStyle(client.lifecycle)} /></td>
                      <td style={{ padding: "0 14px" }}><StatusChip label={client.profitability} map={profitStyle(client.profitability)} /></td>
                      <td style={{ padding: "0 14px" }}><StatusChip label={client.risk} map={riskStyle(client.risk)} /></td>
                      <td style={{ padding: "0 14px" }}><DataStateBadge state={client.data_state} months={client.complete_months} /></td>
                      <td style={{ padding: "0 10px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          {([ ["T", "tier"], ["L", "lifecycle"], ["R", "risk"] ] as Array<[string, WhyDim]>).map(([abbr, dim]) => (
                            <button
                              key={dim}
                              onClick={(event) => {
                                event.stopPropagation();
                                setWhyClient(client);
                                setWhyDim(dim);
                              }}
                              title={`Why ${dim}?`}
                              style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #263544", background: "#0D1D2F", color: "#D7DEE6", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: UI_FONT, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              {abbr}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>
                      No clients match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" style={{ paddingBottom: 18 }}>
            {[
              { seg: "Corporate" as const, label: "Residual Corporate Aggregate", data: RESIDUAL_CORPORATE },
              { seg: "Retail" as const, label: "Retail Aggregate Population", data: RETAIL_AGGREGATE },
            ].map(({ seg, label, data }) => (
              <div key={seg} style={{ border: "1px solid #263544", borderRadius: 10, overflow: "hidden", background: "#102236" }}>
                <div style={{ padding: "10px 16px", background: "#0D1D2F", borderBottom: "1px solid #263544", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <CoverageChip seg={seg} />
                  <span style={{ fontSize: 12, color: "#D7DEE6", fontWeight: 500 }}>{label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#9CA3AF", background: "#102236", border: "1px solid #263544", borderRadius: 4, padding: "1px 6px", fontWeight: 500 }}>
                    No identity or drill-down
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3" style={{ padding: "12px 16px" }}>
                  {[
                    ["Jun P&L", `$${data.jun_pnl.toLocaleString()}`],
                    ["Jun Volume", fmtUSD(data.jun_volume)],
                    ["Jun Deals", String(data.jun_deals)],
                    ["Jun Yield", `${data.jun_yield_bps} bps`],
                    ["May P&L", `$${data.may_pnl.toLocaleString()}`],
                    ["May Yield", `${data.may_yield_bps} bps`],
                  ].map(([labelText, value]) => (
                    <div key={labelText}>
                      <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, marginBottom: 2 }}>{labelText}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#E8F1FA" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "8px 16px", borderTop: "1px solid #263544", fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>{data.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {whyClient ? <WhyDrawer client={whyClient} dim={whyDim} onClose={() => setWhyClient(null)} /> : null}
    </div>
  );
}
