"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { BarChart3, Crosshair, Landmark, Layers } from "lucide-react";
import { ThemedDropdown } from "../components/ThemedDropdown";
import { CurrencyPairSelect } from "../components/CurrencyPairSelect";
import MiniDatePicker from "../components/MiniDatePicker";
import { useEntity } from "../context/EntityContext";
import { User } from "../types/user";
import { usePersistedState } from "../lib/usePersistedState";

const EChartsReact = dynamic(() => import("echarts-for-react"), { ssr: false });

function formatWithThousands(value: number, minFractionDigits = 0, maxFractionDigits = minFractionDigits): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  });
}

function formatCompactAmount(
  value: number,
  decimals: number,
  options?: Readonly<{ currency?: boolean; signed?: boolean }>
): string {
  const numeric = Number(value) || 0;
  const abs = Math.abs(numeric);
  const currency = options?.currency === true;
  const signed = options?.signed === true;

  const sign = signed
    ? (numeric > 0 ? "+" : numeric < 0 ? "-" : "")
    : (numeric < 0 ? "-" : "");

  const prefix = currency ? `${sign}$` : sign;

  if (abs === 0) return `${prefix}0`;

  if (abs >= 1_000_000) {
    return `${prefix}${formatWithThousands(abs / 1_000_000, decimals, decimals)}M`;
  }

  return `${prefix}${formatWithThousands(abs / 1_000, decimals, decimals)}K`;
}

function fmtAmount(v: number, decimals = 0): string {
  return formatCompactAmount(v, decimals);
}

type HedgePerformanceRow = {
  Symbol: string;
  HedgeType: string;
  ExecutionAmountUSD: number;
  ExecutionCount: number;
  PositionPnL: number;
};

type MatchedVsHedgedRow = {
  Symbol: string;
  MatchedAmountUSD: number;
  InGroupHedgeAmountUSD: number;
  ExternalHedgeAmountUSD: number;
};

type LpRow = {
  Venue: string;
  Symbol?: string;
  ExecutionAmountUSD: number;
  ExecutionCount?: number;
  RejectCount?: number;
  SuccessRatio?: number | null;
};

type FxPairRow = {
  Symbol: string;
  value: number;
};

type AnalyticsSectionIcon = "hedge" | "matched" | "interbank" | "trend" | "fx-pair";

const analyticsSectionIcons = {
  hedge: BarChart3,
  matched: Crosshair,
  interbank: Landmark,
  trend: BarChart3,
  "fx-pair": Layers,
};

function AnalyticsSectionTitle({ icon, title }: Readonly<{ icon: AnalyticsSectionIcon; title: string }>) {
  const Icon = analyticsSectionIcons[icon];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 16 }}>
      <Icon size={18.75} strokeWidth={1.9} className="shrink-0" />
      <span>{title}</span>
    </span>
  );
}

type PeriodMatrixData = {
  volume: number[];
  pnl: number[];
  labels: string[];
  paramChanges: number[];
};

type TopCardMetrics = {
  exposureTotal: number;
  pegExcluded: number;
  apmMatching: number;
  apmPosition: number;
  apmTotal: number;
  salesTotal: number;
  flowClient: number;
  flowInterbank: number;
  splitExposureTotal: number[];
  splitPeg: number[];
  splitMatching: number[];
  splitPosition: number[];
  splitSales: number[];
  splitClient: number[];
  splitInterbank: number[];
};

// Non-total Overview rows kept per entity so the top cards can be recomputed
// client-side for any currency-pair selection without another network round-trip.
type TopCardRawEntry = {
  entity: string;
  positionRows: any[];
  clientRows: any[];
  interbankRows: any[];
};

const ALL_ENTITIES = ["KFH", "AUB", "KT"] as const;
const MAX_PERIOD_MATRIX_POINTS = 30;
const ENTITY_SPLIT_ORDER = ["KFH", "AUB", "KT"] as const;
const PEG_EXCLUDED_SYMBOLS = new Set(["USD/SAR", "USD/KWD", "USD/BHD", "USD/AED", "USD/OMR", "USD/QAR"]);

const EMPTY_TOP_CARD_METRICS: TopCardMetrics = {
  exposureTotal: 0,
  pegExcluded: 0,
  apmMatching: 0,
  apmPosition: 0,
  apmTotal: 0,
  salesTotal: 0,
  flowClient: 0,
  flowInterbank: 0,
  splitExposureTotal: [0, 0, 0],
  splitPeg: [0, 0, 0],
  splitMatching: [0, 0, 0],
  splitPosition: [0, 0, 0],
  splitSales: [0, 0, 0],
  splitClient: [0, 0, 0],
  splitInterbank: [0, 0, 0],
};

function normalizeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9eE+.-]+/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function findTotalSummaryRow(rows: any[]): any | undefined {
  return rows.find((row) => {
    const keys = ["Symbol", "symbol", "CurrencyPair", "currencyPair", "Pair", "pair", "Currency", "currency"];
    return keys.some((key) => /^total\b/i.test(String(row?.[key] ?? "").trim()));
  });
}

function splitToPercentages(valuesByEntity: Record<string, number>): number[] {
  const values = ENTITY_SPLIT_ORDER.map((entity) => Math.max(0, normalizeNumber(valuesByEntity[entity])));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [0, 0, 0];

  const raw = values.map((value) => (value / total) * 100);
  const floored = raw.map((value) => Math.floor(value));
  let remainder = 100 - floored.reduce((sum, value) => sum + value, 0);

  const byFraction = raw
    .map((value, idx) => ({ idx, fraction: value - floored[idx] }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < byFraction.length && remainder > 0; i += 1, remainder -= 1) {
    floored[byFraction[i].idx] += 1;
  }

  return floored;
}

function buildTopCardMetricsFromProfiles(profileMetrics: Array<{ entity: string; metrics: Omit<TopCardMetrics, "splitExposureTotal" | "splitPeg" | "splitMatching" | "splitPosition" | "splitSales" | "splitClient" | "splitInterbank"> }>): TopCardMetrics {
  const exposureByEntity: Record<string, number> = {};
  const pegByEntity: Record<string, number> = {};
  const matchingByEntity: Record<string, number> = {};
  const positionByEntity: Record<string, number> = {};
  const salesByEntity: Record<string, number> = {};
  const clientByEntity: Record<string, number> = {};
  const interbankByEntity: Record<string, number> = {};

  profileMetrics.forEach(({ entity, metrics }) => {
    exposureByEntity[entity] = metrics.exposureTotal;
    pegByEntity[entity] = metrics.pegExcluded;
    matchingByEntity[entity] = metrics.apmMatching;
    positionByEntity[entity] = metrics.apmPosition;
    salesByEntity[entity] = metrics.salesTotal;
    clientByEntity[entity] = metrics.flowClient;
    interbankByEntity[entity] = metrics.flowInterbank;
  });

  const exposureTotal = profileMetrics.reduce((sum, p) => sum + p.metrics.exposureTotal, 0);
  const pegExcluded = profileMetrics.reduce((sum, p) => sum + p.metrics.pegExcluded, 0);
  const apmMatching = profileMetrics.reduce((sum, p) => sum + p.metrics.apmMatching, 0);
  const apmPosition = profileMetrics.reduce((sum, p) => sum + p.metrics.apmPosition, 0);
  const salesTotal = profileMetrics.reduce((sum, p) => sum + p.metrics.salesTotal, 0);
  const flowClient = profileMetrics.reduce((sum, p) => sum + p.metrics.flowClient, 0);
  const flowInterbank = profileMetrics.reduce((sum, p) => sum + p.metrics.flowInterbank, 0);

  return {
    exposureTotal,
    pegExcluded,
    apmMatching,
    apmPosition,
    apmTotal: apmMatching + apmPosition,
    salesTotal,
    flowClient,
    flowInterbank,
    splitExposureTotal: splitToPercentages(exposureByEntity),
    splitPeg: splitToPercentages(pegByEntity),
    splitMatching: splitToPercentages(matchingByEntity),
    splitPosition: splitToPercentages(positionByEntity),
    splitSales: splitToPercentages(salesByEntity),
    splitClient: splitToPercentages(clientByEntity),
    splitInterbank: splitToPercentages(interbankByEntity),
  };
}

function normalizeMatrix(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values.slice(0, MAX_PERIOD_MATRIX_POINTS).map((value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  });
}

function normalizeParamChanges(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values.slice(0, MAX_PERIOD_MATRIX_POINTS).map((value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(Math.abs(n)) : 0;
  });
}

function normalizePeriodLabels(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.slice(0, MAX_PERIOD_MATRIX_POINTS).map((value, idx) => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    return text.length > 0 ? text : "";
  });
}

function formatMonthDay(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function buildPeriodAxisLabels(period: string, points: number = MAX_PERIOD_MATRIX_POINTS): string[] {
  const now = new Date();
  const safePoints = Math.max(0, Math.min(MAX_PERIOD_MATRIX_POINTS, Math.trunc(points || 0)));
  const upper = String(period || "TODAY").toUpperCase();

  if (safePoints === 0) return [];

  if (upper === "TODAY") {
    return Array.from({ length: safePoints }, (_, idx) => {
      const d = new Date(now);
      d.setHours(now.getHours() - (safePoints - 1 - idx), 0, 0, 0);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    });
  }

  if (upper === "WTD") {
    return Array.from({ length: safePoints }, (_, idx) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (safePoints - 1 - idx));
      return formatMonthDay(d);
    });
  }

  if (upper === "MTD") {
    return Array.from({ length: safePoints }, (_, idx) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (safePoints - 1 - idx));
      return formatMonthDay(d);
    });
  }

  if (upper === "QTD" || upper === "YTD") {
    return Array.from({ length: safePoints }, (_, idx) => {
      const d = new Date(now);
      d.setMonth(now.getMonth() - (safePoints - 1 - idx), 1);
      return formatMonthDay(d);
    });
  }

  return Array.from({ length: safePoints }, (_, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (safePoints - 1 - idx));
    return formatMonthDay(d);
  });
}

// Canonical currency-pair universe for the Section-1/2 filter dropdown. Any symbol
// returned by the SPs that isn't listed here is merged in dynamically by USD rule.
const CANONICAL_USD_PAIRS = [
  "USD/TRY", "EUR/USD", "GBP/USD", "AUD/USD", "NZD/USD",
  "USD/CAD", "USD/CHF", "USD/JPY", "XAU/USD", "XAG/USD",
];
const CANONICAL_OTHER_PAIRS = ["EUR/TRY", "EUR/JPY", "GBP/JPY", "EUR/GBP"];
const isUsdBasedPair = (pair: string) => String(pair || "").toUpperCase().includes("USD");

function NoDataState({ hint, uiFont }: Readonly<{ hint?: { pairs: string[] }; uiFont: string }>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center", color: "#9CA3AF", fontFamily: uiFont, padding: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#D7DEE6" }}>No Data</div>
      {hint ? (
        <>
          <div style={{ fontSize: 12 }}>Selected pair{hint.pairs.length > 1 ? "s" : ""}: <span style={{ color: "#D7DEE6" }}>{hint.pairs.join(", ")}</span></div>
          <div style={{ fontSize: 11 }}>This widget supports only USD-based pairs.</div>
        </>
      ) : null}
    </div>
  );
}

function sumByKey<T>(rows: T[], getKey: (row: T) => string, merge: (prev: T, next: T) => T): T[] {
  const map = new Map<string, T>();
  rows.forEach((row) => {
    const key = getKey(row);
    const previous = map.get(key);
    map.set(key, previous ? merge(previous, row) : row);
  });
  return Array.from(map.values());
}

// Trade-success ratio (0..100) computed from raw counts. Must be derived from
// summed ExecutionCount / RejectCount — never averaged across symbols/venues.
function successRatioPercent(executionCount?: number | null, rejectCount?: number | null): number {
  const ec = Number(executionCount) || 0;
  const rc = Number(rejectCount) || 0;
  const total = ec + rc;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (ec / total) * 100));
}
export default function ReportsPage() {
  const router = useRouter();
  const { selectedEntity, setSelectedEntity } = useEntity();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isUserResolved, setIsUserResolved] = useState(true);
  const [positionRows, setPositionRows] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hedgePerformanceRows, setHedgePerformanceRows] = useState<HedgePerformanceRow[]>([]);
  const [hedgePerformanceLoading, setHedgePerformanceLoading] = useState(true);
  const [hedgePerformanceError, setHedgePerformanceError] = useState("");
  const hedgeInitialLoadRef = useRef(true);
  const [matchedVsHedgedRows, setMatchedVsHedgedRows] = useState<MatchedVsHedgedRow[]>([]);
  const [matchedVsHedgedLoading, setMatchedVsHedgedLoading] = useState(true);
  const [matchedVsHedgedError, setMatchedVsHedgedError] = useState("");
  const [lpRows, setLpRows] = useState<LpRow[]>([]);
  const [counterpartyRows, setCounterpartyRows] = useState<LpRow[]>([]);
  const [lpLoading, setLpLoading] = useState(true);
  const [lpError, setLpError] = useState("");
  const lpInitialLoadRef = useRef(true);
  const [fxApmRows, setFxApmRows] = useState<FxPairRow[]>([]);
  const [fxApmLoading, setFxApmLoading] = useState(true);
  const [fxApmError, setFxApmError] = useState("");
  const [fxSalesRows, setFxSalesRows] = useState<FxPairRow[]>([]);
  const [fxSalesLoading, setFxSalesLoading] = useState(true);
  const [fxSalesError, setFxSalesError] = useState("");
  // Raw per-entity Overview rows (non-total) used to derive the top metric cards.
  // Stored unfiltered so pair-selection changes recompute instantly without a refetch.
  const [topCardRaw, setTopCardRaw] = useState<TopCardRawEntry[]>([]);
  const [periodMatrixData, setPeriodMatrixData] = useState<PeriodMatrixData>({
    volume: [],
    pnl: [],
    labels: [],
    paramChanges: [],
  });
  const [periodMatrixLoading, setPeriodMatrixLoading] = useState(true);
  const [periodMatrixError, setPeriodMatrixError] = useState("");
  const [periodMatrixSymbols, setPeriodMatrixSymbols] = useState<string[]>([]);
  const [animateOnEntitySwitch, setAnimateOnEntitySwitch] = useState(false);
  const previousEntityRef = useRef("");

  // selected time period — shared across Overview and Analytics pages.
  const [period, setPeriod] = usePersistedState<string>("ui.shared.period", "TODAY");
  // Section-1 symbol filter: "ALL" or a single symbol (persisted like period)
  const [selectedPairs, setSelectedPairs] = usePersistedState<string[] | null>("ui.reports.pairs", null);
  // custom range inputs (enabled only when period === 'CUSTOM') — shared across pages.
  const [customStart, setCustomStart] = usePersistedState<string>("ui.shared.customStart", "");
  const [customEnd, setCustomEnd] = usePersistedState<string>("ui.shared.customEnd", "");
  const [customError, setCustomError] = useState<string>("");
  const [tempStart, setTempStart] = usePersistedState<string>("ui.shared.tempStart", "");
  const [tempEnd, setTempEnd] = usePersistedState<string>("ui.shared.tempEnd", "");

  const normalizedSelectedEntity = String(selectedEntity || "").trim().toUpperCase();
  const normalizedUserEntity = String(currentUser?.entity || "").trim().toUpperCase();
  const isCoEUser = normalizedUserEntity === "ALL";
  const isGroupHeadTrader = String(currentUser?.role || "").trim().toUpperCase() === "GROUP HEAD TRADER";
  let activeEntity = "";
  if (isUserResolved) {
    if (!isCoEUser && !isGroupHeadTrader && normalizedUserEntity) {
      activeEntity = normalizedUserEntity;
    } else {
      activeEntity = normalizedSelectedEntity || "KFH";
    }
  }

  useEffect(() => {
    if (!isUserResolved || !activeEntity) return;
    const previousEntity = previousEntityRef.current;
    previousEntityRef.current = activeEntity;
    if (!previousEntity || previousEntity === activeEntity) return;

    setAnimateOnEntitySwitch(true);
    const timeoutId = globalThis.setTimeout(() => {
      setAnimateOnEntitySwitch(false);
    }, 1200);

    return () => globalThis.clearTimeout(timeoutId);
  }, [activeEntity, isUserResolved]);

  function formatLocalDatetime(input: string): string | null {
    if (!input) return null;
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = parsed.getFullYear();
    const m = pad(parsed.getMonth() + 1);
    const d = pad(parsed.getDate());
    const hh = pad(parsed.getHours());
    const mm = pad(parsed.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function toDateOnly(input: string): string {
    return String(input || "").split("T")[0] || "";
  }

  function validateAndSetCustom(startVal: string, endVal: string) {
    setCustomError("");
    setTempStart(startVal || "");
    setTempEnd(endVal || "");

    const s = formatLocalDatetime(startVal);
    const e = formatLocalDatetime(endVal);

    if (!startVal && !endVal) {
      setCustomStart("");
      setCustomEnd("");
      setCustomError("");
      return false;
    }
    if (!startVal || !endVal) {
      return false;
    }
    if (!s || !e) {
      setCustomError("Invalid date/time");
      return false;
    }
    if (new Date(s) > new Date(e)) {
      setCustomError("Begin must be before or equal to End");
      return false;
    }
    setCustomStart(s);
    setCustomEnd(e);
    setCustomError("");
    return true;
  }

  // Resolve current user (and lock entity for non-CoE/non-group-head users)
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    fetch("/api/users/me", { signal: controller.signal })
      .then((res) => res.json())
      .then((payload) => {
        if (!mounted || !payload?.success || !payload?.user) return;
        setCurrentUser(payload.user);
        const normalizedFetchedEntity = String(payload.user.entity || "").trim().toUpperCase();
        const normalizedRole = String(payload.user.role || "").trim().toUpperCase();
        const fetchedIsCoE = normalizedFetchedEntity === "ALL";
        const fetchedIsGroupHeadTrader = normalizedRole === "GROUP HEAD TRADER";
        if (!fetchedIsCoE && !fetchedIsGroupHeadTrader && normalizedFetchedEntity && normalizedSelectedEntity !== normalizedFetchedEntity) {
          setSelectedEntity(String(payload.user.entity || "").trim());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsUserResolved(true);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [normalizedSelectedEntity, setSelectedEntity]);

  // Fetch positions so TopNavigation can compute cumulative P&L/Position (poll every 1s)
  useEffect(() => {
    let mounted = true;
    let lastController: AbortController | null = null;
    const POLL_MS = 10000;

    async function fetchPositions() {
      if (!isUserResolved || !activeEntity) return;
      if (!mounted) return;
      if (lastController) {
        try { lastController.abort(); } catch {}
      }
      const controller = new AbortController();
      lastController = controller;
      try {
        const profiles = activeEntity === "ALL" ? [...ALL_ENTITIES] : [activeEntity];
        const responses = await Promise.all(
          profiles.map((profile) => fetch(`/api/positions?profile=${profile}`, { signal: controller.signal }))
        );
        if (!mounted) return;

        const okResponses = responses.filter((res) => res.ok);
        if (okResponses.length === 0) {
          setPositionRows([]);
          return;
        }

        const payloads = await Promise.all(okResponses.map((res) => res.json()));
        const mergedRows = payloads.flatMap((payload) => (Array.isArray(payload?.data) ? payload.data : []));
        setPositionRows(mergedRows);
      } catch (err) {
        if (!mounted) return;
        if ((err as any)?.name === "AbortError") return;
        setPositionRows([]);
      }
    }

    fetchPositions();
    const intervalId = setInterval(fetchPositions, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (lastController) {
        try { lastController.abort(); } catch {}
      }
    };
  }, [activeEntity, isUserResolved]);

  // Fetch APM Hedge Performance (section 1)
  useEffect(() => {
    if (!isUserResolved || !activeEntity) return;
    if (period === "CUSTOM" && (!customStart || !customEnd)) {
      setHedgePerformanceRows([]);
      return;
    }

    let mounted = true;
    let controller: AbortController | null = null;
    const POLL_MS = 10000;

    async function fetchHedgePerformance() {
      if (!mounted) return;
      if (controller) {
        try { controller.abort(); } catch {}
      }
      const nextController = new AbortController();
      controller = nextController;

      setHedgePerformanceError("");
      setHedgePerformanceError("");

      try {
        const profiles = activeEntity === "ALL" ? [...ALL_ENTITIES] : [activeEntity];
        const responses = await Promise.all(
          profiles.map((profile) => {
            const params = new URLSearchParams();
            params.set("profile", profile);
            params.set("period", period);
            if (period === "CUSTOM") {
              params.set("startDate", toDateOnly(customStart));
              params.set("endDate", toDateOnly(customEnd));
            }
            return fetch(`/api/reports/apm-hedge-performance?${params.toString()}`, {
              signal: nextController.signal,
            });
          })
        );

        if (!mounted) return;

        const okResponses = responses.filter((res) => res.ok);
        if (okResponses.length === 0) {
          // On a transient poll failure, keep the last good data instead of blanking the chart.
          if (hedgeInitialLoadRef.current) {
            setHedgePerformanceError("Failed to load APM hedge performance");
            setHedgePerformanceRows([]);
          }
          return;
        }

        const payloads = await Promise.all(okResponses.map((res) => res.json()));
        const mappedRows: HedgePerformanceRow[] = payloads
          .flatMap((payload) => (Array.isArray(payload?.data) ? payload.data : []))
          .map((r: any) => ({
            Symbol: String(r.Symbol || ""),
            HedgeType: String(r.HedgeType || ""),
            ExecutionAmountUSD: Number(r.ExecutionAmountUSD) || 0,
            ExecutionCount: Number(r.ExecutionCount) || 0,
            PositionPnL: Number(r.PositionPnL) || 0,
          }));

        // Preserve Symbol so Section-1 can filter by it; aggregate per Symbol+HedgeType across entities.
        const aggregatedRows = sumByKey(
          mappedRows,
          (row) => `${row.Symbol}||${row.HedgeType}`,
          (prev, next) => ({
            Symbol: prev.Symbol,
            HedgeType: prev.HedgeType,
            ExecutionAmountUSD: prev.ExecutionAmountUSD + next.ExecutionAmountUSD,
            ExecutionCount: prev.ExecutionCount + next.ExecutionCount,
            PositionPnL: prev.PositionPnL + next.PositionPnL,
          })
        );

        // A transient poll can return OK responses with empty data; don't blank a chart
        // that already has valid data. Keep the last good rows and retry on the next poll.
        if (aggregatedRows.length === 0 && !hedgeInitialLoadRef.current) {
          return;
        }

        setHedgePerformanceRows(aggregatedRows);
        setLastUpdated(new Date());
        hedgeInitialLoadRef.current = false;
      } catch (err) {
        if (!mounted) return;
        if ((err as any)?.name === "AbortError") return;
        // On a transient poll failure, keep the last good data instead of blanking the chart.
        if (hedgeInitialLoadRef.current) {
          setHedgePerformanceError("Failed to load APM hedge performance");
          setHedgePerformanceRows([]);
        }
      } finally {
        if (mounted) setHedgePerformanceLoading(false);
      }
    }

    fetchHedgePerformance();
    const intervalId = setInterval(fetchHedgePerformance, POLL_MS);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (controller) {
        try { controller.abort(); } catch {}
      }
    };
  }, [activeEntity, isUserResolved, period, customStart, customEnd]);

  // Fetch raw Overview rows for the top card metrics.
  // Always loads every entity so entity/pair switches recompute instantly (client-side).
  useEffect(() => {
    if (!isUserResolved) return;
    if (period === "CUSTOM" && (!customStart || !customEnd)) {
      setTopCardRaw([]);
      return;
    }

    let mounted = true;
    let controller: AbortController | null = null;
    const POLL_MS = 10000;

    async function fetchTopMetrics() {
      if (!mounted) return;
      if (controller) {
        try { controller.abort(); } catch {}
      }
      const next = new AbortController();
      controller = next;

      try {
        const profiles = [...ALL_ENTITIES];

        const results = await Promise.all(
          profiles.map(async (profile) => {
            const params = new URLSearchParams();
            params.set("profile", profile);
            params.set("period", period);
            if (period === "CUSTOM") {
              params.set("startDate", toDateOnly(customStart));
              params.set("endDate", toDateOnly(customEnd));
            }

            const [positionResp, clientResp, interbankResp] = await Promise.all([
              fetch(`/api/overview/position-pnl?${params.toString()}`, { signal: next.signal }),
              fetch(`/api/overview/client-flow-pair?${params.toString()}`, { signal: next.signal }),
              fetch(`/api/overview/interbank-execution?${params.toString()}`, { signal: next.signal }),
            ]);

            const [positionPayload, clientPayload, interbankPayload] = await Promise.all([
              positionResp.ok ? positionResp.json().catch(() => null) : null,
              clientResp.ok ? clientResp.json().catch(() => null) : null,
              interbankResp.ok ? interbankResp.json().catch(() => null) : null,
            ]);

            const positionRows = Array.isArray(positionPayload?.data) ? positionPayload.data : [];
            const clientRows = Array.isArray(clientPayload?.data) ? clientPayload.data : [];
            const interbankRows = Array.isArray(interbankPayload?.data) ? interbankPayload.data : [];

            const positionTotalRow = findTotalSummaryRow(positionRows);
            const clientTotalRow = findTotalSummaryRow(clientRows);
            const interbankTotalRow = findTotalSummaryRow(interbankRows);

            // Keep only the per-symbol rows (drop the Total row so "All" never double-counts).
            // Filtering by selected pairs happens client-side in a memo, so pair changes are instant.
            return {
              entity: String(profile).toUpperCase(),
              positionRows: positionRows.filter((row: any) => row !== positionTotalRow),
              clientRows: clientRows.filter((row: any) => row !== clientTotalRow),
              interbankRows: interbankRows.filter((row: any) => row !== interbankTotalRow),
            };
          })
        );

        if (!mounted) return;
        setTopCardRaw(results);
      } catch (err) {
        if (!mounted) return;
        if ((err as any)?.name === "AbortError") return;
        setTopCardRaw([]);
      }
    }

    fetchTopMetrics();
    const id = setInterval(fetchTopMetrics, POLL_MS);

    return () => {
      mounted = false;
      clearInterval(id);
      if (controller) {
        try { controller.abort(); } catch {}
      }
    };
  }, [isUserResolved, period, customStart, customEnd]);

  // Fetch Hedge Routing by Currency Pair (section 2)
  useEffect(() => {
    if (!isUserResolved || !activeEntity) return;
    if (period === "CUSTOM" && (!customStart || !customEnd)) {
      setMatchedVsHedgedRows([]);
      return;
    }

    let mounted = true;
    let controller: AbortController | null = null;
    const POLL_MS = 10000;

    async function fetchMatchedVsHedged() {
      if (!mounted) return;
      if (controller) {
        try { controller.abort(); } catch {}
      }
      const nextController = new AbortController();
      controller = nextController;

      setMatchedVsHedgedError("");
      setMatchedVsHedgedError("");

      try {
        const profiles = activeEntity === "ALL" ? [...ALL_ENTITIES] : [activeEntity];
        const responses = await Promise.all(
          profiles.map((profile) => {
            const params = new URLSearchParams();
            params.set("profile", profile);
            params.set("period", period);
            if (period === "CUSTOM") {
              params.set("startDate", toDateOnly(customStart));
              params.set("endDate", toDateOnly(customEnd));
            }
            return fetch(`/api/reports/hedge-routing-by-currency-pair?${params.toString()}`, {
              signal: nextController.signal,
            });
          })
        );

        if (!mounted) return;

        const okResponses = responses.filter((res) => res.ok);
        if (okResponses.length === 0) {
          setMatchedVsHedgedError("Failed to load hedge routing by currency pair");
          setMatchedVsHedgedRows([]);
          return;
        }

        const payloads = await Promise.all(okResponses.map((res) => res.json()));
        const mappedRows: MatchedVsHedgedRow[] = payloads
          .flatMap((payload) => (Array.isArray(payload?.data) ? payload.data : []))
          .map((r: any) => ({
            Symbol: String(r.Symbol || ""),
            MatchedAmountUSD: Number(r.MatchedAmountUSD) || 0,
            InGroupHedgeAmountUSD: Number(r.InGroupHedgeAmountUSD) || 0,
            ExternalHedgeAmountUSD: Number(r.ExternalHedgeAmountUSD) || 0,
          }));

        const aggregatedRows = sumByKey(
          mappedRows,
          (row) => row.Symbol,
          (prev, next) => ({
            Symbol: prev.Symbol,
            MatchedAmountUSD: prev.MatchedAmountUSD + next.MatchedAmountUSD,
            InGroupHedgeAmountUSD: prev.InGroupHedgeAmountUSD + next.InGroupHedgeAmountUSD,
            ExternalHedgeAmountUSD: prev.ExternalHedgeAmountUSD + next.ExternalHedgeAmountUSD,
          })
        );

        setMatchedVsHedgedRows(aggregatedRows);
        setLastUpdated(new Date());
      } catch (err) {
        if (!mounted) return;
        if ((err as any)?.name === "AbortError") return;
        setMatchedVsHedgedError("Failed to load hedge routing by currency pair");
        setMatchedVsHedgedRows([]);
      } finally {
        if (mounted) setMatchedVsHedgedLoading(false);
      }
    }

    fetchMatchedVsHedged();
    const intervalId = setInterval(fetchMatchedVsHedged, POLL_MS);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (controller) {
        try { controller.abort(); } catch {}
      }
    };
  }, [activeEntity, isUserResolved, period, customStart, customEnd]);

  // Fetch Client Volume and PnL Trend matrix (section 3)
  useEffect(() => {
    if (!isUserResolved || !activeEntity) return;
    if (period === "CUSTOM" && (!customStart || !customEnd)) {
      setPeriodMatrixData({
        volume: [],
        pnl: [],
        labels: [],
        paramChanges: [],
      });
      return;
    }

    let mounted = true;
    let controller: AbortController | null = null;
    const POLL_MS = 10000;

    async function fetchPeriodMatrix() {
      if (!mounted) return;
      if (controller) {
        try { controller.abort(); } catch {}
      }
      const nextController = new AbortController();
      controller = nextController;

      setPeriodMatrixError("");

      try {
        const profiles = activeEntity === "ALL" ? [...ALL_ENTITIES] : [activeEntity];
        let symbolsParam = "ALL";
        if (selectedPairs !== null) {
          symbolsParam = selectedPairs.length === 0 ? "__NONE__" : selectedPairs.join(",");
        }
        const responses = await Promise.all(
          profiles.map((profile) => {
            const params = new URLSearchParams();
            params.set("profile", profile);
            params.set("period", period);
            params.set("symbols", symbolsParam);
            if (period === "CUSTOM") {
              params.set("startDate", toDateOnly(customStart));
              params.set("endDate", toDateOnly(customEnd));
            }
            return fetch(`/api/reports/period-matrix?${params.toString()}`, { signal: nextController.signal });
          })
        );

        if (!mounted) return;

        const okResponses = responses.filter((res) => res.ok);
        if (okResponses.length === 0) {
          setPeriodMatrixError("Failed to load period matrix report");
          setPeriodMatrixData({
            volume: [],
            pnl: [],
            labels: [],
            paramChanges: [],
          });
          return;
        }

        const payloads = await Promise.all(okResponses.map((res) => res.json()));

        // Distinct pairs present across profiles feed the shared dropdown.
        const symbolSet = new Set<string>();
        for (const payload of payloads) {
          const list = Array.isArray(payload?.data?.symbols) ? payload.data.symbols : [];
          for (const s of list) {
            const t = typeof s === "string" ? s.trim() : "";
            if (t) symbolSet.add(t);
          }
        }
        if (mounted) setPeriodMatrixSymbols(Array.from(symbolSet));

        const volumeTotals: number[] = [];
        const pnlTotals: number[] = [];
        const paramTotals: number[] = [];
        let axisLabels: string[] = [];

        payloads.forEach((payload, payloadIdx) => {
          const data = payload?.data || {};
          const volume = normalizeMatrix(data.volume);
          const pnl = normalizeMatrix(data.pnl);
          const paramChanges = normalizeParamChanges(data.paramChanges);
          const labels = normalizePeriodLabels(data.labels);
          if (payloadIdx === 0) axisLabels = labels;

          const pointCount = Math.max(volume.length, pnl.length, paramChanges.length, volumeTotals.length);
          while (volumeTotals.length < pointCount) {
            volumeTotals.push(0);
            pnlTotals.push(0);
            paramTotals.push(0);
          }

          for (let i = 0; i < pointCount; i += 1) {
            volumeTotals[i] += volume[i] ?? 0;
            pnlTotals[i] += pnl[i] ?? 0;
            paramTotals[i] += paramChanges[i] ?? 0;
          }
        });

        const finalCount = Math.min(
          MAX_PERIOD_MATRIX_POINTS,
          Math.max(volumeTotals.length, pnlTotals.length, paramTotals.length, axisLabels.length)
        );
        const fallbackLabels = buildPeriodAxisLabels(period, finalCount);
        const finalLabels = Array.from({ length: finalCount }, (_, idx) => {
          const axisLabel = (axisLabels[idx] || "").trim();
          // Normalize legacy labels like "1-2" into date labels.
          const isLegacyRange = /^\d{1,2}-\d{1,2}$/.test(axisLabel);
          return axisLabel && !isLegacyRange ? axisLabel : (fallbackLabels[idx] ?? "");
        });

        setPeriodMatrixData({
          volume: volumeTotals.slice(0, finalCount),
          pnl: pnlTotals.slice(0, finalCount),
          labels: finalLabels,
          paramChanges: paramTotals.slice(0, finalCount),
        });
        setLastUpdated(new Date());
      } catch (err) {
        if (!mounted) return;
        if ((err as any)?.name === "AbortError") return;
        setPeriodMatrixError("Failed to load period matrix report");
      } finally {
        if (mounted) setPeriodMatrixLoading(false);
      }
    }

    fetchPeriodMatrix();
    const id = setInterval(fetchPeriodMatrix, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
      if (controller) {
        try { controller.abort(); } catch {}
      }
    };
  }, [activeEntity, isUserResolved, period, customStart, customEnd, selectedPairs]);

  // Fetch FX Pair PnL — APM (position-pnl → TotalPnL)
  useEffect(() => {
    if (!isUserResolved || !activeEntity) return;
    if (period === "CUSTOM" && (!customStart || !customEnd)) { setFxApmRows([]); return; }
    let mounted = true;
    let controller: AbortController | null = null;
    const POLL_MS = 10000;
    async function fetchFxApm() {
      if (!mounted) return;
      if (controller) { try { controller.abort(); } catch {} }
      const next = new AbortController(); controller = next;
      setFxApmError("");
      try {
        const profiles = activeEntity === "ALL" ? [...ALL_ENTITIES] : [activeEntity];
        const responses = await Promise.all(
          profiles.map((profile) => {
            const params = new URLSearchParams();
            params.set("profile", profile);
            params.set("period", period);
            if (period === "CUSTOM") {
              params.set("startDate", toDateOnly(customStart));
              params.set("endDate", toDateOnly(customEnd));
            }
            return fetch(`/api/overview/position-pnl?${params}`, { signal: next.signal });
          })
        );
        if (!mounted) return;

        const okResponses = responses.filter((res) => res.ok);
        if (okResponses.length === 0) { setFxApmError("Failed to load APM PnL"); setFxApmRows([]); return; }

        const payloads = await Promise.all(okResponses.map((res) => res.json()));
        const mappedRows: FxPairRow[] = payloads
          .flatMap((payload) => (Array.isArray(payload?.data) ? payload.data : []))
          .filter((r: any) => !String(r.Symbol || "").toLowerCase().includes("total"))
          .map((r: any) => ({ Symbol: String(r.Symbol || ""), value: Number(r["Total PnL"]) || 0 }));

        const aggregatedRows = sumByKey(
          mappedRows,
          (row) => row.Symbol,
          (prev, nextRow) => ({ Symbol: prev.Symbol, value: prev.value + nextRow.value })
        );

        setFxApmRows(aggregatedRows);
        setLastUpdated(new Date());
      } catch (err) {
        if (!mounted) return;
        if ((err as any)?.name === "AbortError") return;
        setFxApmError("Failed to load APM PnL"); setFxApmRows([]);
      } finally { if (mounted) setFxApmLoading(false); }
    }
    fetchFxApm();
    const id = setInterval(fetchFxApm, POLL_MS);
    return () => { mounted = false; clearInterval(id); if (controller) { try { controller.abort(); } catch {} } };
  }, [activeEntity, isUserResolved, period, customStart, customEnd]);

  // Fetch FX Pair PnL — Sales (client-flow-pair → SalesPnL)
  useEffect(() => {
    if (!isUserResolved || !activeEntity) return;
    if (period === "CUSTOM" && (!customStart || !customEnd)) { setFxSalesRows([]); return; }
    let mounted = true;
    let controller: AbortController | null = null;
    const POLL_MS = 10000;
    async function fetchFxSales() {
      if (!mounted) return;
      if (controller) { try { controller.abort(); } catch {} }
      const next = new AbortController(); controller = next;
      setFxSalesError("");
      try {
        const profiles = activeEntity === "ALL" ? [...ALL_ENTITIES] : [activeEntity];
        const responses = await Promise.all(
          profiles.map((profile) => {
            const params = new URLSearchParams();
            params.set("profile", profile);
            params.set("period", period);
            if (period === "CUSTOM") {
              params.set("startDate", toDateOnly(customStart));
              params.set("endDate", toDateOnly(customEnd));
            }
            return fetch(`/api/overview/client-flow-pair?${params}`, { signal: next.signal });
          })
        );
        if (!mounted) return;

        const okResponses = responses.filter((res) => res.ok);
        if (okResponses.length === 0) { setFxSalesError("Failed to load Sales PnL"); setFxSalesRows([]); return; }

        const payloads = await Promise.all(okResponses.map((res) => res.json()));
        const mappedRows: FxPairRow[] = payloads
          .flatMap((payload) => (Array.isArray(payload?.data) ? payload.data : []))
          .filter((r: any) => !String(r.Symbol || "").toLowerCase().includes("total"))
          .map((r: any) => ({ Symbol: String(r.Symbol || ""), value: Number(r["Sales PnL"]) || 0 }));

        const aggregatedRows = sumByKey(
          mappedRows,
          (row) => row.Symbol,
          (prev, nextRow) => ({ Symbol: prev.Symbol, value: prev.value + nextRow.value })
        );

        setFxSalesRows(aggregatedRows);
        setLastUpdated(new Date());
      } catch (err) {
        if (!mounted) return;
        if ((err as any)?.name === "AbortError") return;
        setFxSalesError("Failed to load Sales PnL"); setFxSalesRows([]);
      } finally { if (mounted) setFxSalesLoading(false); }
    }
    fetchFxSales();
    const id = setInterval(fetchFxSales, POLL_MS);
    return () => { mounted = false; clearInterval(id); if (controller) { try { controller.abort(); } catch {} } };
  }, [activeEntity, isUserResolved, period, customStart, customEnd]);

  const handleLogout = () => {
    fetch("/api/users/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  };

  // Fetch Interbank LP Distribution
  useEffect(() => {
    if (!isUserResolved || !activeEntity) return;
    if (period === "CUSTOM" && (!customStart || !customEnd)) { setLpRows([]); setCounterpartyRows([]); setLpLoading(false); return; }
    let mounted = true;
    let controller: AbortController | null = null;
    const POLL_MS = 10000;

    async function fetchLp() {
      if (!mounted) return;
      if (controller) { try { controller.abort(); } catch {} }
      const nextController = new AbortController();
      controller = nextController;
      if (lpInitialLoadRef.current) setLpLoading(true);
      setLpError("");
      try {
        const profiles = activeEntity === "ALL" ? [...ALL_ENTITIES] : [activeEntity];
        const responses = await Promise.all(
          profiles.map(async (profile) => {
            const params = new URLSearchParams();
            params.set("profile", profile);
            params.set("period", period);
            if (period === "CUSTOM") {
              params.set("startDate", toDateOnly(customStart));
              params.set("endDate", toDateOnly(customEnd));
            }
            const [venueResp, counterpartyResp] = await Promise.all([
              fetch(`/api/reports/lp-distribution?${params.toString()}`, { signal: nextController.signal }),
              fetch(`/api/reports/counterparty-distribution?${params.toString()}`, { signal: nextController.signal }),
            ]);

            const venuePayload = venueResp.ok ? await venueResp.json().catch(() => null) : null;
            const counterpartyPayload = counterpartyResp.ok ? await counterpartyResp.json().catch(() => null) : null;

            return {
              venueData: Array.isArray(venuePayload?.data) ? venuePayload.data : [],
              counterpartyData: Array.isArray(counterpartyPayload?.data) ? counterpartyPayload.data : [],
            };
          })
        );
        if (!mounted) return;

        const mappedRows: LpRow[] = responses
          .flatMap((payload) => payload.venueData)
          .map((r: any) => ({
          Venue: String(r.Venue || ""),
          Symbol: String(r.Symbol || ""),
          ExecutionAmountUSD: Number(r.ExecutionAmountUSD) || 0,
          ExecutionCount: Number(r.ExecutionCount) || 0,
          RejectCount: Number(r.RejectCount) || 0,
          }));

        const mappedCounterpartyRows: LpRow[] = responses
          .flatMap((payload) => payload.counterpartyData)
          .map((r: any) => ({
            Venue: String(r.LpName || r.Venue || ""),
            Symbol: String(r.Symbol || ""),
            ExecutionAmountUSD: Number(r.Amount ?? r.ExecutionAmountUSD) || 0,
            SuccessRatio: null,
          }));

        // Aggregate across profiles per Venue+Symbol (preserve Symbol for the dropdown filter).
        const aggregatedRows = sumByKey(
          mappedRows,
          (row) => `${row.Venue}||${row.Symbol ?? ""}`,
          (prev, nextRow) => ({
            Venue: prev.Venue,
            Symbol: prev.Symbol,
            ExecutionAmountUSD: prev.ExecutionAmountUSD + nextRow.ExecutionAmountUSD,
            ExecutionCount: (Number(prev.ExecutionCount) || 0) + (Number(nextRow.ExecutionCount) || 0),
            RejectCount: (Number(prev.RejectCount) || 0) + (Number(nextRow.RejectCount) || 0),
          })
        );

        const aggregatedCounterpartyRows = sumByKey(
          mappedCounterpartyRows,
          (row) => `${row.Venue}||${row.Symbol ?? ""}`,
          (prev, nextRow) => ({
            Venue: prev.Venue,
            Symbol: prev.Symbol,
            ExecutionAmountUSD: prev.ExecutionAmountUSD + nextRow.ExecutionAmountUSD,
            SuccessRatio: null,
          })
        );

        setLpRows(aggregatedRows);
        setCounterpartyRows(aggregatedCounterpartyRows);
        setLastUpdated(new Date());
      } catch (err) {
        if (!mounted) return;
        if ((err as any)?.name === "AbortError") return;
        setLpError("Failed to load LP distribution"); setLpRows([]); setCounterpartyRows([]);
      } finally {
        if (mounted) setLpLoading(false);
        lpInitialLoadRef.current = false;
      }
    }
    fetchLp();
    const intervalId = setInterval(fetchLp, POLL_MS);
    return () => { mounted = false; clearInterval(intervalId); if (controller) { try { controller.abort(); } catch {} } };
  }, [activeEntity, isUserResolved, period, customStart, customEnd]);

  // Symbol dropdown options, built dynamically from all symbol-bearing sections (1, 2 & 3).
  const sectionOneSymbols = useMemo(() => {
    const set = new Set<string>();
    hedgePerformanceRows.forEach((r) => { if (r.Symbol) set.add(r.Symbol); });
    matchedVsHedgedRows.forEach((r) => { if (r.Symbol) set.add(r.Symbol); });
    lpRows.forEach((r) => { if (r.Symbol) set.add(r.Symbol); });
    counterpartyRows.forEach((r) => { if (r.Symbol) set.add(r.Symbol); });
    periodMatrixSymbols.forEach((s) => { if (s) set.add(s); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [hedgePerformanceRows, matchedVsHedgedRows, lpRows, counterpartyRows, periodMatrixSymbols]);

  // Grouped currency-pair options (USD-based vs Other), built from canonical list + returned data.
  const pairGroups = useMemo(() => {
    const usd = [...CANONICAL_USD_PAIRS];
    const other = [...CANONICAL_OTHER_PAIRS];
    sectionOneSymbols.forEach((s) => {
      if (usd.includes(s) || other.includes(s)) return;
      if (isUsdBasedPair(s)) usd.push(s); else other.push(s);
    });
    return [
      { label: "USD-based", pairs: usd },
      { label: "Other", pairs: other },
    ];
  }, [sectionOneSymbols]);

  const allKnownPairs = useMemo(() => pairGroups.flatMap((g) => g.pairs), [pairGroups]);

  // selectedPairs === null means "All"; [] means none; otherwise an explicit subset.
  const isAllPairs = selectedPairs === null;
  const effectivePairs = useMemo(() => (selectedPairs ?? allKnownPairs), [selectedPairs, allKnownPairs]);
  const pairsSig = isAllPairs ? "ALL" : effectivePairs.join(",");

  const handlePairsChange = (next: string[]) => {
    if (allKnownPairs.length > 0 && next.length >= allKnownPairs.length && allKnownPairs.every((p) => next.includes(p))) {
      setSelectedPairs(null); // treat "everything selected" as All (sticky as universe grows)
    } else {
      setSelectedPairs(next);
    }
  };

  // When the selection is entirely non-USD, USD-only widgets show a hint alongside "No Data".
  const emptyHint = (!isAllPairs && effectivePairs.length > 0 && effectivePairs.every((p) => !isUsdBasedPair(p)))
    ? { pairs: effectivePairs }
    : undefined;

  // Hedge Strategies chart: filter to the selected pairs (or all), then aggregate by HedgeType.
  const hedgePerformanceRowsFiltered = useMemo(() => {
    const isAll = selectedPairs === null;
    const set = new Set(selectedPairs ?? []);
    const source = isAll ? hedgePerformanceRows : hedgePerformanceRows.filter((r) => set.has(r.Symbol));
    return sumByKey(
      source,
      (row) => row.HedgeType,
      (prev, next) => ({
        Symbol: prev.Symbol,
        HedgeType: prev.HedgeType,
        ExecutionAmountUSD: prev.ExecutionAmountUSD + next.ExecutionAmountUSD,
        ExecutionCount: prev.ExecutionCount + next.ExecutionCount,
        PositionPnL: prev.PositionPnL + next.PositionPnL,
      })
    );
  }, [hedgePerformanceRows, selectedPairs]);

  // Top metric cards derived from the raw Overview rows, filtered to the selected pairs.
  // Recomputes instantly on entity/pair changes (no refetch needed for pair changes).
  const topCardMetrics = useMemo<TopCardMetrics>(() => {
    if (topCardRaw.length === 0) return EMPTY_TOP_CARD_METRICS;
    // Canonicalize symbols (uppercase, strip separators) so "USD/TRY" and "USDTRY"
    // match regardless of how each Overview endpoint formats the pair.
    const canonSymbol = (value: string | number | null | undefined) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const pairSet = selectedPairs === null ? null : new Set(selectedPairs.map(canonSymbol));
    const isSelected = (row: any) => pairSet === null || pairSet.has(canonSymbol(row.Symbol));

    // Show the selected entity only, or every entity when "ALL" is active.
    const scopedEntity = String(activeEntity).toUpperCase();
    const scopedRaw = scopedEntity === "ALL"
      ? topCardRaw
      : topCardRaw.filter((entry) => entry.entity === scopedEntity);

    const profileMetrics = scopedRaw.map(({ entity, positionRows, clientRows, interbankRows }) => {
      const selPos = positionRows.filter(isSelected);
      const readUsd = (row: any) => normalizeNumber(row.USD_Equivalent ?? row["USD Equivalent"]);
      const totalExposure = selPos.reduce((sum: number, row: any) => sum + readUsd(row), 0);
      const peggedExposure = selPos
        .filter((row: any) => PEG_EXCLUDED_SYMBOLS.has(String(row.Symbol ?? "").trim().toUpperCase()))
        .reduce((sum: number, row: any) => sum + readUsd(row), 0);
      const apmMatching = selPos.reduce((sum: number, row: any) => sum + normalizeNumber(row["Matching PnL"] ?? row.MatchingPnL ?? row.MatchingPNL), 0);
      const apmPosition = selPos.reduce((sum: number, row: any) => sum + normalizeNumber(row["Position PnL"] ?? row.PositionPnL ?? row.PositionPNL), 0);

      const selClient = clientRows.filter(isSelected);
      // Analytics uses the USD-converted client amount (TotalAmountUSD), not the Overview's Total Amount.
      const flowClient = selClient.reduce((sum: number, row: any) => sum + normalizeNumber(row["Total Amount USD"] ?? row.TotalAmountUSD ?? row["Total Amount"] ?? row.TotalAmount), 0);
      const salesTotal = selClient.reduce((sum: number, row: any) => sum + normalizeNumber(row["Sales PnL"] ?? row.SalesPnL ?? row.SalesPNL), 0);

      // Analytics uses the USD-converted interbank amount (TotalAmountUSD), not the Overview's Total Amount.
      const flowInterbank = interbankRows
        .filter(isSelected)
        .reduce((sum: number, row: any) => sum + normalizeNumber(row["Total Amount USD"] ?? row.TotalAmountUSD ?? row["Total Amount"] ?? row.TotalAmount), 0);

      return {
        entity,
        metrics: {
          exposureTotal: totalExposure,
          pegExcluded: totalExposure - peggedExposure,
          apmMatching,
          apmPosition,
          apmTotal: apmMatching + apmPosition,
          salesTotal,
          flowClient,
          flowInterbank,
        },
      };
    });

    return buildTopCardMetricsFromProfiles(profileMetrics);
  }, [topCardRaw, selectedPairs, activeEntity]);

  // Matched vs Hedged chart: already per-Symbol; just filter to the selected pairs (or all).
  const matchedVsHedgedRowsFiltered = useMemo(() => {
    if (selectedPairs === null) return matchedVsHedgedRows;
    const set = new Set(selectedPairs);
    return matchedVsHedgedRows.filter((r) => set.has(r.Symbol));
  }, [matchedVsHedgedRows, selectedPairs]);

  // Section-2 Venue chart: filter to the selected pairs (or all), then aggregate by Venue.
  const lpRowsFiltered = useMemo(() => {
    const isAll = selectedPairs === null;
    const set = new Set(selectedPairs ?? []);
    const source = isAll ? lpRows : lpRows.filter((r) => set.has(r.Symbol ?? ""));
    // Sum raw counts per venue across the selected symbols, then derive the
    // SuccessRatio from those sums (ratio-of-sums, not sum-of-ratios).
    const aggregated = sumByKey(
      source,
      (row) => row.Venue,
      (prev, nextRow) => ({
        Venue: prev.Venue,
        Symbol: prev.Symbol,
        ExecutionAmountUSD: prev.ExecutionAmountUSD + nextRow.ExecutionAmountUSD,
        ExecutionCount: (Number(prev.ExecutionCount) || 0) + (Number(nextRow.ExecutionCount) || 0),
        RejectCount: (Number(prev.RejectCount) || 0) + (Number(nextRow.RejectCount) || 0),
      })
    );
    return aggregated.map((row) => ({
      ...row,
      SuccessRatio: successRatioPercent(row.ExecutionCount, row.RejectCount),
    }));
  }, [lpRows, selectedPairs]);

  // Section-2 Counterparty chart: filter to the selected pairs (or all), then aggregate by LP.
  const counterpartyRowsFiltered = useMemo(() => {
    const isAll = selectedPairs === null;
    const set = new Set(selectedPairs ?? []);
    const source = isAll ? counterpartyRows : counterpartyRows.filter((r) => set.has(r.Symbol ?? ""));
    return sumByKey(
      source,
      (row) => row.Venue,
      (prev, nextRow) => ({
        Venue: prev.Venue,
        Symbol: prev.Symbol,
        ExecutionAmountUSD: prev.ExecutionAmountUSD + nextRow.ExecutionAmountUSD,
        SuccessRatio: null,
      })
    );
  }, [counterpartyRows, selectedPairs]);

  const formatLastUpdated = (d: Date | null) => {
    if (!d) return "--";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-full bg-[#0A1929] flex flex-col overflow-hidden">

      {/* Period / time selector row */}
      <div className="flex items-center gap-3" style={{ marginLeft: "8px", marginBottom: "0px", marginTop: "-4px" }}>
        <ThemedDropdown
          value={period}
          onChange={(value) => { setPeriod(value); }}
          width={160}
          title="Period"
          buttonClassName="themed-dropdown-trigger overview-period-select flex items-center justify-between rounded px-3 text-white"
          buttonStyle={{ height: 32, marginLeft: 8, paddingTop: 0, paddingBottom: 0, lineHeight: '32px' }}
          options={[
            { value: 'TODAY', label: 'Today' },
            { value: 'WTD', label: 'Week-to-date' },
            { value: 'MTD', label: 'Month-to-date' },
            { value: 'QTD', label: 'Quarter-to-date' },
            { value: 'YTD', label: 'Year-to-date' },
            { value: 'CUSTOM', label: 'Custom' },
          ]}
        />
        <CurrencyPairSelect
          groups={pairGroups}
          selected={effectivePairs}
          onChange={handlePairsChange}
          title="Currency Pair"
          width={170}
          buttonClassName="themed-dropdown-trigger overview-period-select flex items-center justify-between rounded px-3 text-white"
          buttonStyle={{ height: 32, paddingTop: 0, paddingBottom: 0, lineHeight: '32px' }}
        />
        {period === "CUSTOM" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
            <MiniDatePicker
              label="Begin Date"
              value={tempStart || customStart || null}
              minDate="2026-01-01T00:00"
              onChange={(iso) => {
                const formatted = formatLocalDatetime(iso) || "";
                validateAndSetCustom(formatted, tempEnd);
              }}
            />
            <MiniDatePicker
              label="End Date"
              value={tempEnd || customEnd || null}
              minDate="2026-01-01T00:00"
              onChange={(iso) => {
                const formatted = formatLocalDatetime(iso) || "";
                validateAndSetCustom(tempStart, formatted);
              }}
            />
          </div>
        )}
        {customError && (
          <div style={{ color: "#FF4757", marginLeft: 8, fontSize: 13, fontFamily: "Segoe UI" }}>{customError}</div>
        )}
      </div>

      {/* Scrollable report body */}
      <div className="flex-1 overflow-auto px-3 pb-3 pt-2">
        {isUserResolved ? (
          <div className="flex flex-col gap-1.5">
            {/* Top metric cards row (placeholders) */}
            <div className="grid grid-cols-1 items-start md:grid-cols-2 xl:grid-cols-4 gap-1.5">
              <PlaceholderCard title="Exposure Overview" showEntitySplit={activeEntity === "ALL"} metrics={topCardMetrics} />
              <PlaceholderCard title="APM PnL" showEntitySplit={activeEntity === "ALL"} metrics={topCardMetrics} />
              <PlaceholderCard title="Sales PnL" showEntitySplit={activeEntity === "ALL"} metrics={topCardMetrics} />
              <PlaceholderCard title="Flow Volumes" showEntitySplit={activeEntity === "ALL"} metrics={topCardMetrics} />
            </div>

            {/* Remaining sections — single shared island */}
            <div className="rounded-lg border border-[#263544] bg-[#102236] flex flex-col">
              <div className="flex">
                <div style={{ flex: "0 0 48%" }}>
                  <ApmHedgePerformancePanel
                    title={<AnalyticsSectionTitle icon="hedge" title="APM Hedge Performance" />}
                    rows={hedgePerformanceRowsFiltered}
                    loading={hedgePerformanceLoading}
                    error={hedgePerformanceError}
                    matchingPnlTotal={topCardMetrics.apmMatching}
                    chartKey={`${activeEntity || "default"}-${pairsSig}`}
                    animate={animateOnEntitySwitch}
                    emptyHint={emptyHint}
                    bare
                  />
                </div>
                <div style={{ flex: "0 0 2px", background: "#22456b", margin: "16px 0" }} />
                <div style={{ flex: "1 1 0%" }}>
                  <HedgeRoutingByCurrencyPairPanel
                    title={<AnalyticsSectionTitle icon="matched" title="Matched vs Hedged" />}
                    rows={matchedVsHedgedRowsFiltered}
                    loading={matchedVsHedgedLoading}
                    error={matchedVsHedgedError}
                    chartKey={`${activeEntity || "default"}-${pairsSig}`}
                    animate={animateOnEntitySwitch}
                    emptyHint={emptyHint}
                    bare
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 xl:hidden">
              <InterbankLpPanel
                title={<AnalyticsSectionTitle icon="interbank" title="Interbank Venue/Counterparty Distribution & Trade Success" />}
                rows={lpRowsFiltered}
                counterpartyRows={counterpartyRowsFiltered}
                loading={lpLoading}
                error={lpError}
                chartKey={`${activeEntity || "default"}-${pairsSig}`}
                animate={animateOnEntitySwitch}
                emptyHint={emptyHint}
              />
              <ClientVolumePnlTrendPanel
                title={<AnalyticsSectionTitle icon="trend" title="Client Volume and APM PnL Trend" />}
                data={periodMatrixData}
                loading={periodMatrixLoading}
                error={periodMatrixError}
                period={period}
                chartKey={activeEntity || "default"}
                animate={animateOnEntitySwitch}
                showParamMarkers={activeEntity !== "ALL"}
              />
                          <FxPairPnlPanel
                            title={<AnalyticsSectionTitle icon="fx-pair" title="FX Pair PnL" />}
                            apmRows={fxApmRows}
                            apmLoading={fxApmLoading}
                            apmError={fxApmError}
                            salesRows={fxSalesRows}
                            salesLoading={fxSalesLoading}
                            salesError={fxSalesError}
                            chartKey={activeEntity || "default"}
                            animate={animateOnEntitySwitch}
                          />
            </div>
            <div className="hidden xl:flex gap-1.5">
              <div className="flex min-w-0 gap-1.5" style={{ flex: "1 1 0%" }}>
                <div className="min-w-0" style={{ flex: "0 0 41%" }}>
                  <InterbankLpPanel
                    title={<AnalyticsSectionTitle icon="interbank" title="Interbank Venue/Counterparty Distribution & Trade Success" />}
                    rows={lpRowsFiltered}
                    counterpartyRows={counterpartyRowsFiltered}
                    loading={lpLoading}
                    error={lpError}
                    chartKey={`${activeEntity || "default"}-${pairsSig}`}
                    animate={animateOnEntitySwitch}
                    emptyHint={emptyHint}
                  />
                </div>
                <div className="min-w-0" style={{ flex: "1 1 0%" }}>
                  <ClientVolumePnlTrendPanel
                    title={<AnalyticsSectionTitle icon="trend" title="Client Volume and APM PnL Trend" />}
                    data={periodMatrixData}
                    loading={periodMatrixLoading}
                    error={periodMatrixError}
                    period={period}
                    chartKey={activeEntity || "default"}
                    animate={animateOnEntitySwitch}
                    showParamMarkers={activeEntity !== "ALL"}
                  />
                </div>
              </div>
              <div className="min-w-0" style={{ flex: "0 0 24%" }}>
                <FxPairPnlPanel
                  title={<AnalyticsSectionTitle icon="fx-pair" title="FX Pair PnL" />}
                  apmRows={fxApmRows}
                  apmLoading={fxApmLoading}
                  apmError={fxApmError}
                  salesRows={fxSalesRows}
                  salesLoading={fxSalesLoading}
                  salesError={fxSalesError}
                  chartKey={activeEntity || "default"}
                  animate={animateOnEntitySwitch}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#9CA3AF]">
            Loading report...
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderCard({ title, showEntitySplit, metrics }: Readonly<{ title: string; showEntitySplit?: boolean; metrics: TopCardMetrics }>) {
  const uiFont = "'Segoe UI', Arial, Helvetica, sans-serif";
  const [splitHover, setSplitHover] = useState<{ text: string; x: number; y: number } | null>(null);
  const showLayoutGuides = false;
  const logoBoxHeight = 72;
  const headerBoxHeight = 28;
  const middleBoxGap = 5;
  const middleBoxHeight = logoBoxHeight - headerBoxHeight - middleBoxGap;
  type TopCardKind = "exposure" | "apm" | "sales" | "flow";
  const kindByTitle: Record<string, TopCardKind> = {
    "Exposure Overview": "exposure",
    "APM PnL": "apm",
    "Sales PnL": "sales",
    "Flow Volumes": "flow",
  };
  const cardKind = kindByTitle[title];
  const pnlColor = (value: number) => {
    if (value < 0) return "#FF4757";
    return "#2ECC71";
  };

  const fmtM = (v: number, decimals = 1) => formatCompactAmount(v, decimals, { currency: true });
  const fmtSignedM = (v: number, decimals = 2) => formatCompactAmount(v, decimals, { currency: true, signed: true });

  const updateSplitHover = (event: React.MouseEvent<HTMLDivElement>, text: string) => {
    setSplitHover({
      text,
      x: event.clientX + 12,
      y: event.clientY + 12,
    });
  };

  const renderSplitBar = (split: number[], compact = false, flush = false) => {
    if (!showEntitySplit) return null;
    const segs = [
      { label: "KFH", value: split[0], color: "#2ECC714D", textColor: "#2ECC71" },
      { label: "AUB", value: split[1], color: "#2C6FD64D", textColor: "#2C6FD6" },
      { label: "KT", value: split[2], color: "#F4B23A4D", textColor: "#F4B23A" },
    ].filter((seg) => seg.value > 0);

    if (segs.length === 0) return null;

    let splitBarMarginTop = 5;
    if (flush) splitBarMarginTop = 0;
    else if (compact) splitBarMarginTop = 3;

    // Preserve true segment proportions; hide labels when a segment is too narrow.
    const rawWidths = segs.map((seg) => Math.max(0, seg.value));
    const totalWidth = rawWidths.reduce((sum, v) => sum + v, 0);
    const adjusted = totalWidth > 0
      ? rawWidths.map((v) => (v / totalWidth) * 100)
      : rawWidths.map(() => 0);

    return (
      <div
        style={{
          display: "flex",
          marginTop: splitBarMarginTop,
          height: compact ? 16 : 14,
          borderRadius: 5,
          overflow: "hidden",
          fontFamily: uiFont,
        }}
      >
        {segs.map((seg, idx) => {
          const label = `${seg.label} ${seg.value}%`;
          const widthPct = adjusted[idx] ?? 0;
          const minPctForText = Math.max(compact ? 12 : 10, label.length * (compact ? 1.45 : 1.3));
          const canShowText = widthPct >= minPctForText;

          return (
            <div
              key={seg.label}
              aria-label={label}
              onMouseEnter={(event) => updateSplitHover(event, label)}
              onMouseMove={(event) => updateSplitHover(event, label)}
              onMouseLeave={() => setSplitHover(null)}
              style={{
                width: `${widthPct}%`,
                background: seg.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                paddingLeft: "0.4ch",
                paddingRight: "0.25ch",
                fontSize: compact ? 11 : 10,
                color: seg.textColor,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                cursor: "default",
              }}
            >
              {canShowText ? label : ""}
            </div>
          );
        })}
      </div>
    );
  };

  const renderIcon = (src: string, alt: string) => (
    <img
      src={src}
      alt={alt}
      width={70}
      height={86}
      style={{
        width: 70,
        height: 86,
        objectFit: "contain",
        objectPosition: "center",
        transform: "scale(1.1)",
        transformOrigin: "center",
        display: "block",
      }}
    />
  );

  const iconByTitle: Record<string, React.ReactNode> = {
    "Exposure Overview": (
      renderIcon("/icon1.png", "Exposure Overview")
    ),
    "APM PnL": (
      renderIcon("/icon2.png", "APM PnL")
    ),
    "Sales PnL": (
      renderIcon("/icon3.png", "Sales PnL")
    ),
    "Flow Volumes": (
      renderIcon("/icon4.png", "Flow Volumes")
    ),
  };

  const renderPairedColumns = (left: React.ReactNode, right: React.ReactNode) => (
    <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
      <div style={{ width: 2.5, background: "#22456b", margin: showEntitySplit ? 0 : "2px 0 6px" }} />
      <div style={{ flex: 1, minWidth: 0 }}>{right}</div>
    </div>
  );

  const renderPairedColumnsTight = (left: React.ReactNode, right: React.ReactNode) => (
    <div style={{ display: "flex", gap: 10, marginTop: 0, alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
      <div style={{ width: 2.5, background: "#22456b", margin: "-1.5px 0" }} />
      <div style={{ flex: 1, minWidth: 0 }}>{right}</div>
    </div>
  );

  const renderExposure = (includeSplit: boolean) => (
    renderPairedColumns(
      <div>
        <div style={{ color: "#9FB1C5", fontSize: 12, fontFamily: uiFont, lineHeight: 1.1 }}>Total Exposure</div>
        <div style={{ color: "#E9F0F8", fontSize: 14, lineHeight: 1.1, marginTop: 1, fontWeight: 600, fontFamily: uiFont }}>{fmtM(metrics.exposureTotal)}</div>
        {includeSplit ? renderSplitBar(metrics.splitExposureTotal, true) : null}
      </div>,
      <div>
        <div style={{ color: "#9FB1C5", fontSize: 12, fontFamily: uiFont, lineHeight: 1.1 }}>Peg-Excluded Exposure</div>
        <div style={{ color: "#E9F0F8", fontSize: 14, lineHeight: 1.1, marginTop: 1, fontWeight: 600, fontFamily: uiFont }}>{fmtM(metrics.pegExcluded)}</div>
        {includeSplit ? renderSplitBar(metrics.splitPeg, true) : null}
      </div>
    )
  );

  const renderApmOrSales = (isApm: boolean, includeSplit: boolean) => {
    if (!isApm) {
      if (!includeSplit) {
        return (
          <div style={{ minHeight: 34 }} />
        );
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: showEntitySplit ? 50 : 40 }}>
          <div style={{ width: "100%" }}>
            {includeSplit ? renderSplitBar(metrics.splitSales, true) : null}
          </div>
        </div>
      );
    }
    return renderPairedColumns(
      <div>
        <div style={{ color: "#9FB1C5", fontSize: 12, fontFamily: uiFont, lineHeight: 1.1 }}>Matching PnL</div>
        <div style={{ color: pnlColor(metrics.apmMatching), fontSize: 14, fontWeight: 600, marginTop: 1, fontFamily: uiFont }}>{fmtSignedM(metrics.apmMatching)}</div>
        {includeSplit ? renderSplitBar(metrics.splitMatching, true) : null}
      </div>,
      <div>
        <div style={{ color: "#9FB1C5", fontSize: 12, fontFamily: uiFont, lineHeight: 1.1 }}>Position PnL</div>
        <div style={{ color: pnlColor(metrics.apmPosition), fontSize: 14, fontWeight: 600, marginTop: 1, fontFamily: uiFont }}>{fmtSignedM(metrics.apmPosition)}</div>
        {includeSplit ? renderSplitBar(metrics.splitPosition, true) : null}
      </div>
    );
  };

  const renderFlow = (includeSplit: boolean) => (
    renderPairedColumns(
      <div>
        <div style={{ color: "#9FB1C5", fontSize: 12, fontFamily: uiFont, lineHeight: 1.1 }}>Client Volume</div>
        <div style={{ color: "#E9F0F8", fontSize: 14, lineHeight: 1.1, marginTop: 1, fontWeight: 600, fontFamily: uiFont }}>{fmtM(metrics.flowClient, 0)}</div>
        {includeSplit ? renderSplitBar(metrics.splitClient, true) : null}
      </div>,
      <div>
        <div style={{ color: "#9FB1C5", fontSize: 12, fontFamily: uiFont, lineHeight: 1.1 }}>Interbank Volume</div>
        <div style={{ color: "#E9F0F8", fontSize: 14, lineHeight: 1.1, marginTop: 1, fontWeight: 600, fontFamily: uiFont }}>{fmtM(metrics.flowInterbank, 0)}</div>
        {includeSplit ? renderSplitBar(metrics.splitInterbank, true) : null}
      </div>
    )
  );

  const renderAllGraphsRow = (kind: TopCardKind) => {
    if (!showEntitySplit) return null;

    if (kind === "exposure") {
      return renderPairedColumnsTight(
        <div>{renderSplitBar(metrics.splitExposureTotal, true, true)}</div>,
        <div>{renderSplitBar(metrics.splitPeg, true, true)}</div>
      );
    }

    if (kind === "apm") {
      return renderPairedColumnsTight(
        <div>{renderSplitBar(metrics.splitMatching, true, true)}</div>,
        <div>{renderSplitBar(metrics.splitPosition, true, true)}</div>
      );
    }

    if (kind === "sales") {
      return <div>{renderSplitBar(metrics.splitSales, true, true)}</div>;
    }

    return renderPairedColumnsTight(
      <div>{renderSplitBar(metrics.splitClient, true, true)}</div>,
      <div>{renderSplitBar(metrics.splitInterbank, true, true)}</div>
    );
  };

  const renderMiddleContent = (kind: TopCardKind) => {
    if (kind === "exposure") return renderExposure(false);
    if (kind === "apm") return renderApmOrSales(true, false);
    if (kind === "sales") return renderApmOrSales(false, false);
    return renderFlow(false);
  };

  const renderHeadlineTotal = (kind: TopCardKind) => {
    if (kind !== "apm" && kind !== "sales") return null;
    const total = kind === "apm" ? metrics.apmTotal : metrics.salesTotal;
    return (
      <div style={{ color: pnlColor(total), fontSize: 18, lineHeight: 1.05, fontWeight: 700, fontFamily: uiFont, paddingTop: 1 }}>
        {fmtSignedM(total)}
      </div>
    );
  };

  if (!cardKind) return null;

  return (
    <>
      <div
        className="rounded-lg border border-[#263544] bg-[#102236] px-[10px] pb-[12px] pt-[12px]"
        style={{
          minHeight: 57,
          background: "linear-gradient(180deg, rgba(16,34,54,1) 0%, rgba(12,29,47,1) 100%)",
          overflow: "hidden",
          alignSelf: "start",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px minmax(0, 1fr)",
            columnGap: 10,
            alignItems: "stretch",
            height: "100%",
          }}
        >
        <div
          style={{
            width: 70,
            height: logoBoxHeight,
            borderRadius: 14,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: showLayoutGuides ? "1px solid rgba(118,178,232,0.45)" : undefined,
          }}
        >
          {iconByTitle[title] ?? null}
        </div>

        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 6,
              border: showLayoutGuides ? "1px solid rgba(118,178,232,0.45)" : undefined,
              padding: "2px 4px",
              height: headerBoxHeight,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
              <div style={{ fontFamily: uiFont, fontSize: 18, color: "#FFFFFF", fontWeight: 600, lineHeight: 1.05 }}>{title}</div>
            </div>
            {renderHeadlineTotal(cardKind)}
          </div>

          <div
            style={{
              minWidth: 0,
              alignSelf: "stretch",
              border: showLayoutGuides ? "1px solid rgba(118,178,232,0.45)" : undefined,
              padding: "2px 4px",
              marginTop: middleBoxGap,
              height: middleBoxHeight,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div style={{ width: "100%" }}>{renderMiddleContent(cardKind)}</div>
          </div>

          {showEntitySplit && (
            <div
              style={{
                minWidth: 0,
                border: showLayoutGuides ? "1px solid rgba(118,178,232,0.45)" : undefined,
                padding: "1.5px 0",
              }}
            >
              {renderAllGraphsRow(cardKind)}
            </div>
          )}
        </div>
        </div>
      </div>
      {splitHover ? (
        <div
          style={{
            position: "fixed",
            left: splitHover.x,
            top: splitHover.y,
            zIndex: 9999,
            pointerEvents: "none",
            backgroundColor: "rgba(0,0,0,0.75)",
            border: "1px solid #263544",
            color: "#D7DEE6",
            borderRadius: 4,
            padding: "6px 8px",
            fontSize: 12,
            fontFamily: uiFont,
            whiteSpace: "nowrap",
          }}
        >
          {splitHover.text}
        </div>
      ) : null}
    </>
  );
}

function ApmHedgePerformancePanel({
  title,
  rows,
  loading,
  error,
  matchingPnlTotal,
  chartKey,
  animate,
  emptyHint,
  bare,
}: Readonly<{
  title: ReactNode;
  rows: HedgePerformanceRow[];
  loading: boolean;
  error: string;
  matchingPnlTotal: number;
  chartKey: string;
  animate: boolean;
  emptyHint?: { pairs: string[] };
  bare?: boolean;
}>) {
  const uiFont = "'Segoe UI', Arial, Helvetica, sans-serif";

  const normalizeTypeKey = (value: string) => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  // Permanent hedge-type color contract used by both the pie and the table badges.
  const canonicalTypeKeyByAlias: Record<string, string> = {
    takeprofit: "takeprofit",
    tp: "takeprofit",
    stoploss: "stoploss",
    sl: "stoploss",
    overhedge: "overhedge",
    transfer: "transfer",
    manualclose: "manualclose",
  };

  const fixedColorByCanonicalType: Record<string, string> = {
    takeprofit: "#2ECC71", // green
    stoploss: "#FF4757",   // red
    overhedge: "#F4B23A",
    transfer: "#2C5680",
    manualclose: "#A78BFA",
  };

  const deterministicColorFromType = (normalizedType: string): string => {
    if (!normalizedType) return "#2C5680";
    let hash = 0;
    for (let i = 0; i < normalizedType.length; i += 1) {
      hash = ((hash << 5) - hash + normalizedType.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 62% 52%)`;
  };

  const getHedgeTypeColor = (hedgeType: string) => {
    const normalized = normalizeTypeKey(hedgeType);
    const canonical = canonicalTypeKeyByAlias[normalized] ?? normalized;
    return fixedColorByCanonicalType[canonical] ?? deterministicColorFromType(canonical);
  };

  const totalAmount = rows.reduce((sum, row) => sum + (Number.isFinite(row.ExecutionAmountUSD) ? row.ExecutionAmountUSD : 0), 0);
  const totalTradeCount = rows.reduce((sum, row) => sum + (Number.isFinite(row.ExecutionCount) ? row.ExecutionCount : 0), 0);
  const totalPnL = rows.reduce((sum, row) => sum + (Number.isFinite(row.PositionPnL) ? row.PositionPnL : 0), 0);
  const totalCompactVolume = formatCompactAmount(totalAmount, 1, { currency: true });
  
  const withPercentages = rows.map((row) => {
    const amount = Number.isFinite(row.ExecutionAmountUSD) ? row.ExecutionAmountUSD : 0;
    const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
    return { ...row, percentage };
  });

  const chartOption = useMemo(() => ({
    animation: animate,
    tooltip: {
      trigger: "item",
      formatter: "{b}",
      backgroundColor: "rgba(13, 29, 47, 0.96)",
      borderColor: "#3A4A5C",
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold", fontFamily: uiFont },
      extraCssText: "box-shadow: 0 2px 8px rgba(0,0,0,0.5); z-index: 9999;",
    },
    graphic: {
      elements: [
        {
          type: "text",
          id: "apm-hedge-center-text",
          left: "center",
          top: "center",
          style: {
            text: `Volume\n${totalCompactVolume}`,
            fill: "#FFFFFF",
            fontSize: 16,
            fontWeight: "bold",
            fontFamily: uiFont,
            textAlign: "center",
          },
        },
      ],
    },
    series: [
      {
        type: "pie",
        radius: ["58%", "99%"],
        center: ["50%", "50%"],
        label: {
          show: true,
          position: "inside",
          formatter: (p: any) => `${Number(p?.percent ?? 0).toFixed(1)}%`,
          fontSize: 12,
          color: "#FFFFFF",
          fontWeight: "bold",
          fontFamily: uiFont,
        },
        itemStyle: {
          borderRadius: 4,
          borderColor: "#0D1D2F",
          borderWidth: 1,
        },
        emphasis: {
          scale: true,
          scaleSize: 4,
          itemStyle: {
            borderColor: "#0D1D2F",
            borderWidth: 1,
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.45)",
          },
        },
        data: withPercentages.map((row) => {
          const sliceColor = getHedgeTypeColor(row.HedgeType);
          return {
            value: row.ExecutionAmountUSD,
            name: row.HedgeType,
            itemStyle: { color: sliceColor },
            // Pin the emphasis color to the base color so hover can never turn it into the background color.
            emphasis: { itemStyle: { color: sliceColor } },
          };
        }),
      },
    ],
  }), [rows, animate]);

  let leftContent: React.ReactNode;
  if (loading) {
    leftContent = <div style={{ color: "#9CA3AF", fontFamily: uiFont, fontSize: 12 }}>Loading...</div>;
  } else if (error) {
    leftContent = <div style={{ color: "#FF4757", fontFamily: uiFont, fontSize: 12 }}>{error}</div>;
  } else if (withPercentages.length === 0) {
    leftContent = <NoDataState hint={emptyHint} uiFont={uiFont} />;
  } else {
    leftContent = (
      <div
        style={{
          width: "100%",
          height: 275,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EChartsReact
          key={`apm-hedge-${chartKey}`}
          option={chartOption}
          style={{ width: "100%", height: "100%" }}
          opts={{ renderer: "svg" }}
          notMerge={false}
          lazyUpdate={true}
        />
      </div>
    );
  }

  let tableBodyContent: React.ReactNode;
  if (loading) {
    tableBodyContent = (
      <tr>
        <td colSpan={5} className="px-3 py-4 text-center" style={{ color: "#9CA3AF" }}>Loading...</td>
      </tr>
    );
  } else if (error) {
    tableBodyContent = (
      <tr>
        <td colSpan={5} className="px-3 py-4 text-center" style={{ color: "#FF4757" }}>{error}</td>
      </tr>
    );
  } else if (withPercentages.length === 0) {
    tableBodyContent = (
      <tr>
        <td colSpan={5} className="px-3 py-4 text-center" style={{ color: "#9CA3AF" }}>No data</td>
      </tr>
    );
  } else {
    tableBodyContent = withPercentages.map((row) => (
      <tr key={row.HedgeType} className="border-t border-[#263544]" style={{ color: "#D7DEE6" }}>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1.5">
            <span style={{ width: 12, height: 12, borderRadius: 9999, background: getHedgeTypeColor(row.HedgeType) }} />
            {row.HedgeType}
          </span>
        </td>
        <td className="px-3 py-2 text-right">{formatCompactAmount(row.ExecutionAmountUSD, 0, { currency: true })}</td>
        <td className="px-3 py-2 text-right">{formatInteger(row.ExecutionCount)}</td>
        <td className="px-3 py-2 text-right" style={{ color: row.PositionPnL >= 0 ? "#2ECC71" : "#FF4757" }}>
          {formatSignedCurrency(row.PositionPnL, 0)}
        </td>
        <td className="px-3 py-2 text-right" style={{ color: "#5B6B7B" }}>&mdash;</td>
      </tr>
    ));
    // Add totals footer row
    const totalFooterContent = (
      <>
        {tableBodyContent}
        <tr style={{ height: "100%" }}><td colSpan={5} /></tr>
        <tr style={{ color: "#FFFFFF", fontWeight: "bold", borderTop: "2px solid #263544" }}>
          <td className="px-3 py-3">Total</td>
          <td className="px-3 py-3 text-right">{formatCompactAmount(totalAmount, 0, { currency: true })}</td>
          <td className="px-3 py-3 text-right">{formatInteger(totalTradeCount)}</td>
          <td className="px-3 py-3 text-right" style={{ color: totalPnL >= 0 ? "#2ECC71" : "#FF4757" }}>
            {formatSignedCurrency(totalPnL, 0)}
          </td>
          <td className="px-3 py-3 text-right" style={{ color: matchingPnlTotal >= 0 ? "#2ECC71" : "#FF4757" }}>
            {formatSignedCurrency(matchingPnlTotal, 0)}
          </td>
        </tr>
      </>
    );
    tableBodyContent = totalFooterContent;
  }

  return (
    <div className={bare ? "p-4 h-full flex flex-col" : "rounded-lg border border-[#263544] bg-[#102236] p-4 h-full flex flex-col"} style={{ minHeight: 260 }}>
      <div style={{ fontFamily: uiFont, fontSize: "12.5px", color: "#FFFFFF", fontWeight: 600 }}>{title}</div>

      <div className="mt-3 grid grid-cols-1 gap-2 flex-1 min-h-0" style={{ gridTemplateColumns: "minmax(0, 0.62fr) minmax(0, 1fr)" }}>
        <div className="flex flex-col items-center justify-center rounded-md">
          {leftContent}
        </div>

        <div className="rounded-md overflow-hidden flex flex-col">
          <table className="w-full h-full" style={{ fontFamily: uiFont, fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#9CA3AF" }}>
                <th className="text-left px-3 py-2">Hedge Type</th>
                <th className="text-right px-3 py-2">Volume</th>
                <th className="text-right px-3 py-2">Trade Count</th>
                <th className="text-right px-3 py-2">Position PnL</th>
                <th className="text-right px-3 py-2">Matching PnL</th>
              </tr>
            </thead>
            <tbody>{tableBodyContent}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HedgeRoutingByCurrencyPairPanel({
  title,
  rows,
  loading,
  error,
  chartKey,
  animate,
  emptyHint,
  bare,
}: Readonly<{
  title: ReactNode;
  rows: MatchedVsHedgedRow[];
  loading: boolean;
  error: string;
  chartKey: string;
  animate: boolean;
  emptyHint?: { pairs: string[] };
  bare?: boolean;
}>) {
  const uiFont = "'Segoe UI', Arial, Helvetica, sans-serif";

  const sorted = rows
    .map((row) => {
      const matched = Number(row.MatchedAmountUSD) || 0;
      const inGroup = Number(row.InGroupHedgeAmountUSD) || 0;
      const external = Number(row.ExternalHedgeAmountUSD) || 0;
      const total = matched + inGroup + external;
      return {
        symbol: row.Symbol,
        matched,
        inGroup,
        external,
        total,
        matchedPct: total > 0 ? (matched / total) * 100 : 0,
        inGroupPct: total > 0 ? (inGroup / total) * 100 : 0,
        externalPct: total > 0 ? (external / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  const top4 = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  let prepared = top4;
  if (rest.length > 0) {
    const oM = rest.reduce((s, r) => s + r.matched, 0);
    const oG = rest.reduce((s, r) => s + r.inGroup, 0);
    const oE = rest.reduce((s, r) => s + r.external, 0);
    const oT = oM + oG + oE;
    prepared = [...top4, {
      symbol: "Other",
      matched: oM,
      inGroup: oG,
      external: oE,
      total: oT,
      matchedPct: oT > 0 ? (oM / oT) * 100 : 0,
      inGroupPct: oT > 0 ? (oG / oT) * 100 : 0,
      externalPct: oT > 0 ? (oE / oT) * 100 : 0,
    }];
  }

  const maxTotal = prepared.length > 0 ? Math.max(...prepared.map((r) => r.total), 0) : 0;

  const categories = prepared.map((r) => r.symbol);
  const matchedSeries = prepared.map((r) => (maxTotal > 0 ? (r.matched / maxTotal) * 100 : 0));
  const inGroupSeries = prepared.map((r) => (maxTotal > 0 ? (r.inGroup / maxTotal) * 100 : 0));
  const externalSeries = prepared.map((r) => (maxTotal > 0 ? (r.external / maxTotal) * 100 : 0));
  const matchedColor = "#2C5680";
  const inGroupColor = "#2ECC71";
  const minSegmentLabelPct = 1;
  const minRenderedSegmentWidthPct = 3;
  const shouldShowSegmentLabel = (rowSegmentPct: number, renderedSegmentWidthPct: number) => {
    if (!Number.isFinite(rowSegmentPct) || !Number.isFinite(renderedSegmentWidthPct)) return false;
    return rowSegmentPct >= minSegmentLabelPct && renderedSegmentWidthPct >= minRenderedSegmentWidthPct;
  };

  const chartOption = {
    animation: animate,
    grid: {
      left: 78,
      right: 83,
      top: 30,
      bottom: 12,
      containLabel: false,
    },
    legend: {
      top: 0,
      left: "center",
      itemWidth: 15,
      itemHeight: 15,
      textStyle: { color: "#D7DEE6", fontSize: 12, fontFamily: uiFont },
      data: ["Matched", "In-group Hedged", "External Hedged"],
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      borderColor: "#263544",
      textStyle: { color: "#D7DEE6", fontSize: 12, fontFamily: uiFont },
      formatter: (params: any) => {
        const index = Number(params?.[0]?.dataIndex) || 0;
        const row = prepared[index];
        if (!row) return "";
        return [
          `<b>${row.symbol}</b>`,
          `Matched: ${formatCompactAmount(row.matched, 0, { currency: true })}`,
          `In-group Hedged: ${formatCompactAmount(row.inGroup, 0, { currency: true })}`,
          `External Hedged: ${formatCompactAmount(row.external, 0, { currency: true })}`,
          `Total: ${formatCompactAmount(row.total, 0, { currency: true })}`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { show: false },
      splitLine: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: categories,
      axisLabel: { color: "#D7DEE6", fontSize: 12, fontFamily: uiFont, margin: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Matched",
        type: "bar",
        stack: "routing",
        barWidth: 18,
        data: matchedSeries,
        itemStyle: { color: matchedColor, borderRadius: [2, 0, 0, 2] },
        label: {
          show: true,
          position: "inside",
          color: "#D7DEE6",
          fontSize: 12,
          fontFamily: uiFont,
          formatter: (p: any) => {
            const row = prepared[Number(p.dataIndex) || 0];
            const renderedWidth = Number(p?.value) || 0;
            if (!row || !shouldShowSegmentLabel(row.matchedPct, renderedWidth)) return "";
            return `${row.matchedPct.toFixed(0)}%`;
          },
        },
      },
      {
        name: "In-group Hedged",
        type: "bar",
        stack: "routing",
        barWidth: 18,
        data: inGroupSeries,
        itemStyle: { color: inGroupColor },
        label: {
          show: true,
          position: "inside",
          color: "#D7DEE6",
          fontSize: 12,
          fontFamily: uiFont,
          formatter: (p: any) => {
            const row = prepared[Number(p.dataIndex) || 0];
            const renderedWidth = Number(p?.value) || 0;
            if (!row || !shouldShowSegmentLabel(row.inGroupPct, renderedWidth)) return "";
            return `${row.inGroupPct.toFixed(0)}%`;
          },
        },
      },
      {
        name: "External Hedged",
        type: "bar",
        stack: "routing",
        barWidth: 18,
        data: externalSeries,
        itemStyle: { color: "#D97A2B", borderRadius: [0, 2, 2, 0] },
        label: {
          show: true,
          position: "inside",
          color: "#D7DEE6",
          fontSize: 12,
          fontFamily: uiFont,
          formatter: (p: any) => {
            const row = prepared[Number(p.dataIndex) || 0];
            const renderedWidth = Number(p?.value) || 0;
            if (!row || !shouldShowSegmentLabel(row.externalPct, renderedWidth)) return "";
            return `${row.externalPct.toFixed(0)}%`;
          },
        },
      },
      {
        name: "Total Scale",
        type: "bar",
        stack: "routing",
        silent: true,
        barWidth: 18,
        data: prepared.map((r) => (maxTotal > 0 ? 100 - (r.total / maxTotal) * 100 : 100)),
        itemStyle: { color: "transparent" },
        emphasis: { disabled: true },
        label: {
          show: true,
          position: "right",
          color: "#9CA3AF",
          fontSize: 11,
          fontFamily: uiFont,
          formatter: (p: any) => {
            const row = prepared[Number(p.dataIndex) || 0];
            if (!row) return "";
            return formatCompactAmount(row.total, 0, { currency: true });
          },
        },
      },
    ],
  };

  let bodyContent: React.ReactNode;
  if (loading) {
    bodyContent = (
      <div className="w-full h-full flex items-center justify-center" style={{ color: "#9CA3AF", fontSize: 12, fontFamily: uiFont }}>
        Loading...
      </div>
    );
  } else if (error) {
    bodyContent = (
      <div className="w-full h-full flex items-center justify-center" style={{ color: "#FF4757", fontSize: 12, fontFamily: uiFont }}>
        {error}
      </div>
    );
  } else if (prepared.length === 0) {
    bodyContent = (
      <div className="w-full h-full flex items-center justify-center">
        <NoDataState hint={emptyHint} uiFont={uiFont} />
      </div>
    );
  } else {
    bodyContent = (
      <EChartsReact
        key={`hedge-routing-${chartKey}`}
        option={chartOption}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge={false}
        lazyUpdate={true}
      />
    );
  }

  return (
    <div className={bare ? "p-4 h-full flex flex-col" : "rounded-lg border border-[#263544] bg-[#102236] p-4 h-full flex flex-col"} style={{ minHeight: 260 }}>
      <div style={{ fontFamily: uiFont, fontSize: "12.5px", color: "#FFFFFF", fontWeight: 600 }}>{title}</div>

      <div className="mt-3 rounded-md flex-1" style={{ minHeight: 0 }}>
        {bodyContent}
      </div>
    </div>
  );
}

function InterbankLpPanel({
  title, rows, counterpartyRows, loading, error, chartKey, animate, emptyHint, className,
}: Readonly<{ title: ReactNode; rows: LpRow[]; counterpartyRows: LpRow[]; loading: boolean; error: string; chartKey: string; animate: boolean; emptyHint?: { pairs: string[] }; className?: string }>) {
  const uiFont = "'Segoe UI', Arial, Helvetica, sans-serif";
  const [view, setView] = useState<"lps" | "counterparties">("lps");
  const [animateOnViewSwitch, setAnimateOnViewSwitch] = useState(false);
  const previousViewRef = useRef<"lps" | "counterparties">("lps");
  const hasSuccessRatio = view === "lps";
  const sourceRows = view === "counterparties" ? counterpartyRows : rows;
  const MAX_COLUMNS = 10;

  const sortedRows = useMemo(() => {
    return [...sourceRows].sort((a, b) => {
      const amountDiff = (Number(b.ExecutionAmountUSD) || 0) - (Number(a.ExecutionAmountUSD) || 0);
      if (amountDiff !== 0) return amountDiff;
      return String(a.Venue || "").localeCompare(String(b.Venue || ""));
    });
  }, [sourceRows]);

  const displayRows = useMemo(() => {
    if (sortedRows.length <= MAX_COLUMNS) return sortedRows;

    const visible = sortedRows.slice(0, MAX_COLUMNS - 1);
    const tail = sortedRows.slice(MAX_COLUMNS - 1);
    const otherVolume = tail.reduce((sum, row) => sum + (Number(row.ExecutionAmountUSD) || 0), 0);

    let otherSuccessRatio: number | null = null;
    if (hasSuccessRatio) {
      const totalExecution = tail.reduce((sum, row) => sum + (Number(row.ExecutionCount) || 0), 0);
      const totalReject = tail.reduce((sum, row) => sum + (Number(row.RejectCount) || 0), 0);
      otherSuccessRatio = successRatioPercent(totalExecution, totalReject);
    }

    return [
      ...visible,
      {
        Venue: "Others",
        ExecutionAmountUSD: otherVolume,
        ExecutionCount: tail.reduce((sum, row) => sum + (Number(row.ExecutionCount) || 0), 0),
        RejectCount: tail.reduce((sum, row) => sum + (Number(row.RejectCount) || 0), 0),
        SuccessRatio: otherSuccessRatio,
      },
    ];
  }, [sortedRows, hasSuccessRatio]);

  const lpNames = displayRows.map((r) => r.Venue);
  const amounts = displayRows.map((r) => Number(r.ExecutionAmountUSD) || 0);
  const successRatios = hasSuccessRatio ? displayRows.map((r) => Number(r.SuccessRatio) || 0) : [];

  const wrapAxisLabel = (label: string, maxCharsPerLine = 12, maxLines = 3): string => {
    const sanitized = label
      .replaceAll("/", " ")
      .replaceAll("_", " ")
      .replaceAll("-", " ");
    const words = sanitized.split(" ").filter(Boolean);

    const lines: string[] = [];
    let currentLine = "";

    const pushLine = (line: string) => {
      if (!line) return;
      if (lines.length < maxLines) lines.push(line);
    };

    const pushWord = (word: string) => {
      if (currentLine.length === 0) {
        currentLine = word;
        return;
      }
      const candidate = `${currentLine} ${word}`;
      if (candidate.length <= maxCharsPerLine) {
        currentLine = candidate;
      } else {
        pushLine(currentLine);
        currentLine = word;
      }
    };

    words.forEach((word) => {
      if (word.length <= maxCharsPerLine) {
        pushWord(word);
        return;
      }

      const chunks: string[] = [];
      for (let start = 0; start < word.length; start += maxCharsPerLine) {
        chunks.push(word.slice(start, start + maxCharsPerLine));
      }
      chunks.forEach((chunk) => {
        if (currentLine) {
          pushLine(currentLine);
          currentLine = "";
        }
        pushLine(chunk);
      });
    });

    if (currentLine) pushLine(currentLine);
    if (lines.length === 0) return label;

    if (lines.length > maxLines) {
      const trimmed = lines.slice(0, maxLines);
      trimmed[maxLines - 1] = `${trimmed[maxLines - 1].slice(0, Math.max(0, maxCharsPerLine - 1))}…`;
      return trimmed.join("\n");
    }

    return lines.slice(0, maxLines).join("\n");
  };

  const volumeColor = "#2C5680";
  const successRateColor = "#F4B23A";
  const shouldAnimate = animate || animateOnViewSwitch;

  useEffect(() => {
    const previousView = previousViewRef.current;
    previousViewRef.current = view;
    if (previousView === view) return;

    setAnimateOnViewSwitch(true);
    const timeoutId = globalThis.setTimeout(() => {
      setAnimateOnViewSwitch(false);
    }, 1200);

    return () => globalThis.clearTimeout(timeoutId);
  }, [view]);

  // Value-axis inset so the first/last bars sit clear of the inside y-axis
  // numbers (a category axis can't inset bars by a fixed amount).
  const catCount = lpNames.length;
  const xPad = catCount > 1 ? Math.min(1.8, Math.max(0.35, (catCount - 1) * 0.16)) : 0.5;
  const xTicks = Array.from({ length: catCount }, (_, i) => i);

  const chartOption = {
    animation: shouldAnimate,
    grid: { left: 8, right: 8, top: 60, bottom: 32, containLabel: false },
    legend: {
      top: 0, left: "center", itemWidth: 10, itemHeight: 10,
      textStyle: { color: "#D7DEE6", fontSize: 11, fontFamily: uiFont },
      data: hasSuccessRatio
        ? [{ name: "Volume", icon: "rect" }, { name: "Success Rate (%)", icon: "triangle" }]
        : [{ name: "Volume", icon: "rect" }],
    },
    tooltip: {
      trigger: "axis", axisPointer: { type: "line", lineStyle: { color: "rgba(215,222,230,0.25)", width: 1 } },
      backgroundColor: "rgba(0,0,0,0.75)", borderColor: "#263544",
      textStyle: { color: "#D7DEE6", fontSize: 12, fontFamily: uiFont },
      formatter: (params: any) => {
        const idx = params?.[0]?.dataIndex ?? 0;
        const lines = [`<b>${lpNames[idx]}</b>`, `Volume: ${formatCompactAmount(amounts[idx], 0, { currency: true })}`];
        if (hasSuccessRatio) lines.push(`Success Rate: ${(successRatios[idx] ?? 0).toFixed(1)}%`);
        return lines.join("<br/>");
      },
    },
    xAxis: [{
      type: "value",
      min: -xPad,
      max: catCount - 1 + xPad,
      axisLabel: {
        color: "#D7DEE6",
        fontSize: 10,
        fontFamily: uiFont,
        margin: 10,
        rotate: 40,
        align: "right",
        hideOverlap: false,
        customValues: xTicks,
        formatter: (val: number) => {
          const i = Math.round(val);
          return (i >= 0 && i < catCount) ? wrapAxisLabel(String(lpNames[i]), 10, 2) : "";
        },
      },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: "#263544" } },
      axisTick: { show: false, customValues: xTicks },
    }],
    yAxis: [
      {
        type: "value", name: "Volume", nameLocation: "end", splitNumber: 4, nameGap: 30,
        nameTextStyle: { color: "#9CA3AF", fontSize: 10, fontFamily: uiFont, align: "left", verticalAlign: "bottom", padding: [0, 0, 0, 8] },
        axisLabel: { color: "#9CA3AF", fontSize: 10, fontFamily: uiFont, inside: true, formatter: (v: number) => fmtAmount(v) },
        splitLine: { lineStyle: { color: "rgba(44,86,128,0.12)", type: "dashed" } },
        axisLine: { show: false }, axisTick: { show: false },
      },
      ...(hasSuccessRatio
        ? [{
            type: "value", name: "Success Rate (%)", min: 0, max: 100, interval: 25, nameLocation: "end", nameGap: 30,
            nameTextStyle: { color: "#9CA3AF", fontSize: 10, fontFamily: uiFont, align: "right", verticalAlign: "bottom", padding: [0, 8, 0, 0] },
            axisLabel: { color: "#9CA3AF", fontSize: 10, fontFamily: uiFont, inside: true, formatter: "{value}%" },
            splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
          }]
        : []),
    ],
    series: [
      {
        name: "Volume", type: "bar", yAxisIndex: 0, barWidth: "55%", data: amounts.map((v, i) => [i, v]),
        itemStyle: { color: volumeColor, borderRadius: [3, 3, 0, 0] },
        label: {
          show: true, position: "inside", color: "#FFFFFF", fontSize: 11, fontFamily: uiFont,
          formatter: (p: any) => {
            const v = amounts[p.dataIndex] ?? 0;
            const total = amounts.reduce((s: number, a: number) => s + a, 0);
            const pct = total > 0 ? ((v / total) * 100).toFixed(0) : "0";
            return `${formatCompactAmount(v, 0, { currency: true })}\n${pct}%`;
          },
        },
      },
      ...(hasSuccessRatio
        ? [{
            name: "Success Rate (%)", type: "line", yAxisIndex: 1, data: successRatios.map((v, i) => [i, v]),
            smooth: false, symbol: "triangle", symbolSize: 9,
            lineStyle: { color: successRateColor, width: 2 }, itemStyle: { color: successRateColor },
            label: { show: true, position: "top", color: successRateColor, fontSize: 10, fontFamily: uiFont,
              formatter: (p: any) => `${(successRatios[p.dataIndex] ?? 0).toFixed(0)}%` },
          }]
        : []),
    ],
  };

  let content: React.ReactNode;
  if (loading) {
    content = <div className="w-full h-full flex items-center justify-center" style={{ color: "#9CA3AF", fontSize: 12, fontFamily: uiFont }}>Loading...</div>;
  } else if (error) {
    content = <div className="w-full h-full flex items-center justify-center" style={{ color: "#FF4757", fontSize: 12, fontFamily: uiFont }}>{error}</div>;
  } else if (displayRows.length === 0) {
    content = <div className="w-full h-full flex items-center justify-center"><NoDataState hint={emptyHint} uiFont={uiFont} /></div>;
  } else {
    content = <EChartsReact key={`lp-distribution-${chartKey}-${view}`} option={chartOption} style={{ width: "100%", height: "100%" }} opts={{ renderer: "svg" }} notMerge={false} lazyUpdate={true} />;
  }

  return (
    <div className={`rounded-lg border border-[#263544] bg-[#102236] p-4 h-full flex flex-col ${className ?? ""}`} style={{ minHeight: 305 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: uiFont, fontSize: "14px", color: "#FFFFFF", fontWeight: 600 }}>{title}</div>
        <div style={{ display: "flex", background: "#0D1D2F", borderRadius: 6, border: "1px solid #263544", overflow: "hidden" }}>
          {(["lps", "counterparties"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "4px 12px", fontSize: 11, fontFamily: uiFont, fontWeight: 600, cursor: "pointer", border: "none",
                background: view === v ? "#2C5680" : "transparent",
                color: view === v ? "#FFFFFF" : "#9CA3AF",
              }}
            >
              {v === "lps" ? "Venues" : "CounterParties"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex-1" style={{ minHeight: 0 }}>
        {content}
      </div>
    </div>
  );
}

function ClientVolumePnlTrendPanel({
  title,
  data,
  loading,
  error,
  period,
  chartKey,
  animate,
  showParamMarkers,
}: Readonly<{
  title: ReactNode;
  data: PeriodMatrixData;
  loading: boolean;
  error: string;
  period: string;
  chartKey: string;
  animate: boolean;
  showParamMarkers: boolean;
}>) {
  const uiFont = "'Segoe UI', Arial, Helvetica, sans-serif";

  const volume = normalizeMatrix(data.volume);
  const pnl = normalizeMatrix(data.pnl);
  const changes = normalizeParamChanges(data.paramChanges);
  const pointCount = Math.max(
    volume.length,
    pnl.length,
    changes.length,
    Array.isArray(data.labels) ? Math.min(data.labels.length, MAX_PERIOD_MATRIX_POINTS) : 0
  );
  const volumeSeries = useMemo(
    () => Array.from({ length: pointCount }, (_, idx) => volume[idx] ?? 0),
    [pointCount, volume]
  );
  const pnlSeries = useMemo(
    () => Array.from({ length: pointCount }, (_, idx) => pnl[idx] ?? 0),
    [pointCount, pnl]
  );
  const changeSeries = useMemo(
    () => Array.from({ length: pointCount }, (_, idx) => changes[idx] ?? 0),
    [pointCount, changes]
  );
  const volumeColor = '#2C5680';
  const labels = useMemo(
    () => (Array.isArray(data.labels) && data.labels.length > 0 ? normalizePeriodLabels(data.labels) : buildPeriodAxisLabels(period, pointCount)),
    [data.labels, period, pointCount]
  );

  // Parameter-change markers: shown only for a single entity, at periods
  // where at least one parameter changed (integer part > 0).
  const paramIdxs = showParamMarkers
    ? changeSeries.map((count, idx) => ({ count, idx })).filter((item) => item.count > 0).map((item) => item.idx)
    : [];

  // Value-axis inset so the first/last bars sit clear of the inside y-axis numbers.
  const catCount = labels.length;
  const xPad = catCount > 1 ? Math.min(1.6, Math.max(0.35, (catCount - 1) * 0.1)) : 0.5;
  const xTicks = Array.from({ length: catCount }, (_, i) => i);

  const chartOption = {
    animation: animate,
    grid: { left: 8, right: 8, top: 60, bottom: 42 },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 12,
      itemHeight: 11,
      textStyle: { color: '#D7DEE6', fontSize: 11, fontFamily: uiFont },
      data: [
        { name: 'Volume', icon: 'rect' },
        { name: 'PnL ($)', icon: 'path://M1 4 L15 4 L15 8 L1 8 Z' },
        { name: 'Parameter Changed', icon: 'rect' },
      ],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderColor: '#263544',
      textStyle: { color: '#D7DEE6', fontSize: 12, fontFamily: uiFont },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [];
        const firstWithIndex = list.find((p: any) => Number.isInteger(p?.dataIndex));
        const idx = Number(firstWithIndex?.dataIndex ?? 0);
        return `<b>${labels[idx] ?? ''}</b><br/>Volume: ${formatCompactAmount(volumeSeries[idx] ?? 0, 0, { currency: true })}<br/>PnL: ${formatCompactAmount(pnlSeries[idx] ?? 0, 0, { currency: true, signed: true })}`;
      },
    },
    xAxis: {
      type: 'value',
      min: -xPad,
      max: catCount - 1 + xPad,
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        fontFamily: uiFont,
        rotate: 40,
        margin: 10,
        align: 'right',
        customValues: xTicks,
        formatter: (val: number) => {
          const i = Math.round(val);
          return (i >= 0 && i < catCount) ? String(labels[i] ?? '') : '';
        },
      },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: '#263544' } },
      axisTick: { show: false, customValues: xTicks },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Volume',
        nameLocation: 'end', splitNumber: 4, nameGap: 30,
        nameTextStyle: { color: '#9CA3AF', fontSize: 10, fontFamily: uiFont, align: 'left', verticalAlign: 'bottom', padding: [0, 0, 0, 8] },
        axisLabel: { color: '#9CA3AF', fontSize: 10, fontFamily: uiFont, inside: true, formatter: (v: number) => fmtAmount(v, 0) },
        splitLine: { lineStyle: { color: 'rgba(44,86,128,0.12)', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      {
        type: 'value',
        name: 'PnL ($)',
        nameLocation: 'end', splitNumber: 4, nameGap: 30,
        nameTextStyle: { color: '#9CA3AF', fontSize: 10, fontFamily: uiFont, align: 'right', verticalAlign: 'bottom', padding: [0, 8, 0, 0] },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 10,
          fontFamily: uiFont,
          inside: true,
          formatter: (v: number) => {
            const sign = v >= 0 ? '' : '-';
            const abs = Math.abs(v);
            if (abs >= 1_000_000) return `${sign}${formatWithThousands(abs / 1_000_000, 0, 0)}M`;
            if (abs > 0) return `${sign}${formatWithThousands(abs / 1_000, 0, 0)}K`;
            return "0";
          },
        },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
      },
    ],
    series: [
      {
        name: 'Volume',
        type: 'bar',
        yAxisIndex: 0,
        data: volumeSeries.map((v, i) => [i, v]),
        barWidth: '55%',
        itemStyle: { color: volumeColor, borderRadius: [3, 3, 0, 0] },
        label: {
          show: true,
          position: 'top',
          color: '#9EC1EA',
          fontSize: 10,
          fontFamily: uiFont,
          formatter: (p: any) => formatCompactAmount(Number(Array.isArray(p.value) ? p.value[1] : p.value) || 0, 0, { currency: true }),
        },
      },
      {
        name: 'PnL ($)',
        type: 'line',
        yAxisIndex: 1,
        data: pnlSeries.map((v, i) => [i, v]),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#D97A2B', width: 2 },
        itemStyle: { color: '#D97A2B' },
      },
      {
        name: 'Parameter Changed',
        type: 'scatter',
        yAxisIndex: 0,
        silent: true,
        z: 8,
        data: paramIdxs.map((idx) => [idx, 0]),
        symbol: 'rect',
        symbolSize: [8, 8],
        itemStyle: { color: '#2ECC71' },
        emphasis: { disabled: true },
        tooltip: { show: false },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { color: '#2ECC71', type: 'dashed', width: 1.5 },
          label: { show: false },
          data: paramIdxs.map((idx) => ({ xAxis: idx })),
        },
      },
    ],
  };

  let body: React.ReactNode;
  const hasData = volumeSeries.some((v) => v !== 0) || pnlSeries.some((v) => v !== 0);
  if (loading) {
    body = <div className="w-full h-full flex items-center justify-center" style={{ color: '#9CA3AF', fontSize: 12, fontFamily: uiFont }}>Loading...</div>;
  } else if (error) {
    body = <div className="w-full h-full flex items-center justify-center" style={{ color: '#FF4757', fontSize: 12, fontFamily: uiFont }}>{error}</div>;
  } else if (!hasData) {
    body = <div className="w-full h-full flex items-center justify-center"><NoDataState uiFont={uiFont} /></div>;
  } else {
    body = (
      <EChartsReact
        key={`client-volume-pnl-${chartKey}-${period}`}
        option={chartOption}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge={false}
        lazyUpdate={true}
      />
    );
  }

  return (
    <div className="rounded-lg border border-[#263544] bg-[#102236] p-4 h-full flex flex-col overflow-hidden" style={{ minHeight: 305, height: 305 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontFamily: uiFont, fontSize: '14px', color: '#FFFFFF', fontWeight: 600 }}>{title}</div>
      </div>
      <div className="mt-2 flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {body}
      </div>
    </div>
  );
}

function FxPairPnlPanel({
  title, apmRows, apmLoading, apmError, salesRows, salesLoading, salesError, chartKey, animate,
}: Readonly<{
  title: ReactNode;
  apmRows: FxPairRow[]; apmLoading: boolean; apmError: string;
  salesRows: FxPairRow[]; salesLoading: boolean; salesError: string;
  chartKey: string;
  animate: boolean;
}>) {
  const uiFont = "'Segoe UI', Arial, Helvetica, sans-serif";
  const [mode, setMode] = useState<"apm" | "sales">("apm");

  const rows = mode === "apm" ? apmRows : salesRows;
  const loading = mode === "apm" ? apmLoading : salesLoading;
  const error = mode === "apm" ? apmError : salesError;

  const TOP_N = 6;
  const sorted = [...rows].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const displayRows: FxPairRow[] = rest.length > 0
    ? [...top, { Symbol: "Other", value: rest.reduce((s, r) => s + r.value, 0) }]
    : top;

  const stablePalette = ["#2ECC71", "#FF4757", "#F4B23A", "#2C5680", "#A78BFA", "#2E9C5E", "#2C5680", "#7A57C9", "#D97A2B", "#1C8C85", "#B84D9A"];

  const fmtPnL = (v: number) => formatCompactAmount(v, 1, { currency: true, signed: true });

  const totalPnL = rows.reduce((s, r) => s + r.value, 0);

  const positiveRows = displayRows.filter((r) => r.value >= 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const negativeRows = displayRows.filter((r) => r.value < 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const ordered = [...positiveRows, ...negativeRows];

  const colorBySymbol = (symbol: string) => {
    let hash = 0;
    for (let i = 0; i < symbol.length; i += 1) {
      hash = (hash * 31 + (symbol.codePointAt(i) ?? 0)) >>> 0;
    }
    return stablePalette[hash % stablePalette.length];
  };

  const treemapData = ordered.map((row) => {
    return {
      name: row.Symbol,
      value: Math.max(Math.abs(row.value), 1),
      pnl: row.value,
      itemStyle: { color: colorBySymbol(row.Symbol), borderRadius: 6, borderColor: "#0A2235", borderWidth: 2 },
    };
  });

  const chartOption = {
    animation: animate,
    tooltip: {
      formatter: (p: any) => `${p?.name ?? ""}<br/>PnL: ${fmtPnL(Number(p?.data?.pnl) || 0)}`,
      backgroundColor: "rgba(0,0,0,0.75)",
      borderColor: "#263544",
      textStyle: { color: "#D7DEE6", fontSize: 12, fontFamily: uiFont },
    },
    series: [
      {
        type: "treemap",
        left: 1,
        top: 1,
        right: 1,
        bottom: 1,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        squareRatio: 1,
        visibleMin: 1,
        data: treemapData,
        label: {
          show: true,
          position: "inside",
          align: "center",
          verticalAlign: "middle",
          color: "#EAF2F9",
          fontSize: 11,
          fontFamily: uiFont,
          fontWeight: 600,
          lineHeight: 15,
          overflow: "truncate",
          formatter: (p: any) => {
            const pnl = Number(p?.data?.pnl) || 0;
            return `${p?.name ?? ""}\n${fmtPnL(pnl)}`;
          },
        },
        upperLabel: { show: false },
        itemStyle: {
          borderColor: "#0A2235",
          borderWidth: 2,
          gapWidth: 2,
        },
      },
    ],
  };

  let content: React.ReactNode;
  if (loading) {
    content = <div className="flex items-center justify-center" style={{ height: 212, color: "#9CA3AF", fontSize: 12, fontFamily: uiFont }}>Loading...</div>;
  } else if (error) {
    content = <div className="flex items-center justify-center" style={{ height: 212, color: "#FF4757", fontSize: 12, fontFamily: uiFont }}>{error}</div>;
  } else if (displayRows.length === 0) {
    content = <div className="flex items-center justify-center" style={{ height: 212, color: "#9CA3AF", fontSize: 12, fontFamily: uiFont }}>No data</div>;
  } else {
    content = (
      <div>
        <div style={{ height: 212, padding: "2px" }}>
          <EChartsReact
            key={`fx-pnl-${chartKey}-${mode}`}
            option={chartOption}
            style={{ width: "100%", height: "100%" }}
            opts={{ renderer: "svg" }}
            notMerge={false}
            lazyUpdate={true}
          />
        </div>
        <div style={{ fontFamily: uiFont, fontSize: 12, color: totalPnL >= 0 ? "#2ECC71" : "#FF4757", padding: "0 10px 8px", fontWeight: 700, textAlign: "center" }}>
          Total PnL: {fmtPnL(totalPnL)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#263544] bg-[#102236] p-4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: uiFont, fontSize: "14px", color: "#FFFFFF", fontWeight: 600 }}>{title}</div>
        <div style={{ display: "flex", background: "#0D1D2F", borderRadius: 6, border: "1px solid #263544", overflow: "hidden" }}>
          {(["apm", "sales"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "4px 12px", fontSize: 11, fontFamily: uiFont, fontWeight: 600, cursor: "pointer", border: "none",
                background: mode === m ? "#2C5680" : "transparent",
                color: mode === m ? "#FFFFFF" : "#9CA3AF",
              }}
            >
              {m === "apm" ? "APM PnL" : "Sales PnL"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2">{content}</div>
    </div>
  );
}

function formatInteger(value: number): string {
  return Math.round(Number(value) || 0).toLocaleString("en-US");
}

function formatSignedCurrency(value: number, maxFractionDigits = 2): string {
  const numeric = Number(value) || 0;
  const sign = numeric >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(numeric).toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits })}`;
}
