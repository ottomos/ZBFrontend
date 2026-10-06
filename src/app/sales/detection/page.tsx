"use client";

import React, { useEffect, useMemo, useState } from "react";
import { detections, type Detection } from "../mockData";

const UI_FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

const RULE_DEFS: Record<string, { name: string; version: string; priority: string; summary: string }> = {
  "RULE-001": {
    name: "Material Volume Decline",
    version: "v1.4",
    priority: "Dynamic (High/Medium)",
    summary: "Triggered when Latest-3 / Preceding-9 average ratio <= 0.75, T12 Volume >= USD 250,000 and baseline active months >= 3. High if decline >= 40%, Medium if >= 25%.",
  },
  "RULE-002": {
    name: "High-Value Dormancy",
    version: "v1.0",
    priority: "High",
    summary: "Triggered when a Diamond or Platinum tier client enters Dormant or Lost lifecycle stage. Days-since-activity exceeds the dormancy threshold.",
  },
  "RULE-003": {
    name: "Negative Profitability",
    version: "v1.0",
    priority: "High",
    summary: "Triggered when rolling T12 profitability (USD) <= -5,000.",
  },
  "RULE-004": {
    name: "Material Growth",
    version: "v1.2",
    priority: "Medium",
    summary: "Triggered when Latest-3 / Preceding-9 average ratio >= 1.40, T12 Volume >= USD 250,000 and T12 active months >= 6. Concentration <= 60%.",
  },
  "RULE-005": {
    name: "Spot-Only Product Mix",
    version: "v1.3",
    priority: "Medium",
    summary: "Observation-only. Spot deals >= 6, Spot active months >= 3, Spot volume >= USD 250,000, Forward deals = 0 and Forward volume = 0.",
  },
};

const HISTORY: Record<string, Array<{ as_of: string; state: "Active" | "No Detection" | "Resolved"; decline_pct?: number; growth_pct?: number; reason?: string }>> = {
  "CIF-100184-RULE-001": [
    { as_of: "2026-05-31", state: "No Detection", decline_pct: 23.9 },
    { as_of: "2026-06-30", state: "Active", decline_pct: 44.8 },
  ],
  "CIF-100392-RULE-001": [
    { as_of: "2026-05-31", state: "No Detection" },
    { as_of: "2026-06-30", state: "Active", decline_pct: 100.0 },
  ],
  "CIF-100517-RULE-004": [
    { as_of: "2026-03-31", state: "Active", growth_pct: 575.0 },
    { as_of: "2026-04-30", state: "Resolved", reason: "MATERIALITY_THRESHOLD_NOT_MET" },
    { as_of: "2026-05-31", state: "Resolved" },
    { as_of: "2026-06-30", state: "Resolved" },
  ],
};

function severityColor(severity: Detection["severity"]): string {
  if (severity === "High") return "#FF4757";
  if (severity === "Medium") return "#F4B23A";
  return "#2ECC71";
}

function severityBackground(severity: Detection["severity"]): string {
  if (severity === "High") return "#0D1D2F";
  if (severity === "Medium") return "#102236";
  return "#1A334C";
}

function statusColors(status: Detection["status"]): { bg: string; text: string; border: string } {
  if (status === "Open") return { bg: "#102236", text: "#FF4757", border: "#FF4757" };
  if (status === "Acknowledged") return { bg: "#102236", text: "#F4B23A", border: "#F4B23A" };
  return { bg: "#102236", text: "#2ECC71", border: "#2ECC71" };
}

function coverageColors(seg: Detection["coverage_segment"]): { bg: string; text: string; border: string } {
  if (seg === "VIP") return { bg: "#102236", text: "#2ECC71", border: "#2ECC71" };
  if (seg === "Institution") return { bg: "#102236", text: "#2C6FD6", border: "#2C6FD6" };
  return { bg: "#1A334C", text: "#D7DEE6", border: "#263544" };
}

function evidenceRows(det: Detection): Array<[string, string, boolean]> {
  return [
    ["Rule", `${det.rule} ${det.rule_version}`, false],
    ["Detection ID", det.id, false],
    ["Client", det.client_name, false],
    ["CIF", det.cif, false],
    ["Coverage Segment", det.coverage_segment, false],
    ["Detected", det.detected_date, false],
    ["Status", det.status, false],
    ["Severity", det.severity, false],
    [det.evidence_label, det.evidence_value, true],
    [det.threshold_label, det.threshold_value, false],
  ];
}

function reasonCode(det: Detection): string {
  if (det.evidence_label.includes("Decline")) return "MATERIAL_VOLUME_DECLINE_MET";
  if (det.evidence_label.includes("Days")) return "HIGH_VALUE_DORMANCY_MET";
  if (det.evidence_label.includes("Growth")) return "MATERIAL_GROWTH_MET";
  if (det.observation_only) return "SPOT_ONLY_PRODUCT_MIX_OBSERVED";
  return "TRIGGERED";
}

function historyForDetection(det: Detection) {
  return HISTORY[`${det.cif}-${det.rule}`] ?? null;
}

function SeverityBadge({ severity }: Readonly<{ severity: Detection["severity"] }>) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: severityBackground(severity), color: severityColor(severity), border: `1px solid ${severityColor(severity)}`, fontFamily: UI_FONT }}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: Readonly<{ status: Detection["status"] }>) {
  const colors = statusColors(status);
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, fontFamily: UI_FONT }}>
      {status}
    </span>
  );
}

function CoverageChip({ seg }: Readonly<{ seg: Detection["coverage_segment"] }>) {
  const colors = coverageColors(seg);
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, fontFamily: UI_FONT }}>
      {seg}
    </span>
  );
}

function DetectionListRow({ det, active, onClick }: Readonly<{ det: Detection; active: boolean; onClick: () => void }>) {
  const accent = severityColor(det.severity);
  const hasMultiple = detections.filter((item) => item.cif === det.cif).length > 1;
  const rowBg = active ? "#1A334C" : "#102236";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "12px 16px 12px 19px",
        fontFamily: UI_FONT,
        background: rowBg,
        borderTop: "none",
        borderRight: "none",
        borderBottom: "1px solid #263544",
        borderLeft: `3px solid ${active ? "#2C5680" : accent}`,
        cursor: "pointer",
        minHeight: 64,
        outline: active ? "1px solid #2C5680" : "none",
        outlineOffset: -1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#E8F1FA" }}>{det.rule}</span>
            <span style={{ fontSize: 11, color: "#D7DEE6", fontWeight: 500 }}>{RULE_DEFS[det.rule]?.name ?? det.type}</span>
            <SeverityBadge severity={det.severity} />
            {det.observation_only ? (
              <span style={{ fontSize: 9, color: "#D7DEE6", background: "#0D1D2F", border: "1px solid #263544", padding: "1px 5px", borderRadius: 3, fontWeight: 600, letterSpacing: "0.04em", fontFamily: UI_FONT }}>
                OBS
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: "#D7DEE6", fontWeight: 600, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {det.client_name}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <CoverageChip seg={det.coverage_segment} />
            <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{det.evidence_value}</span>
            {hasMultiple ? <span style={{ fontSize: 10, color: "#D97A2B", fontWeight: 600 }}>+multiple</span> : null}
            <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, marginLeft: "auto" }}>{det.detected_date}</span>
          </div>
        </div>
        <StatusBadge status={det.status} />
      </div>
    </button>
  );
}

function EvidencePanel({ det }: Readonly<{ det: Detection }>) {
  const accent = severityColor(det.severity);
  const rows = evidenceRows(det);
  const history = historyForDetection(det);
  const ruleDef = RULE_DEFS[det.rule];
  let valuePercent = 0;
  let thresholdPercent = 0;
  if (det.threshold_value !== "N/A") {
    const numericValue = Number.parseFloat(det.evidence_value.replace(/[^0-9.-]/g, ""));
    const numericThreshold = Number.parseFloat(det.threshold_value.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(numericValue) && !Number.isNaN(numericThreshold)) {
      const absValue = Math.abs(numericValue);
      const absThreshold = Math.abs(numericThreshold);
      const maxValue = Math.max(absValue, absThreshold) * 1.3 || 1;
      valuePercent = Math.min((absValue / maxValue) * 100, 100);
      thresholdPercent = Math.min((absThreshold / maxValue) * 100, 100);
    }
  }

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%", fontFamily: UI_FONT, background: "#102236" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#E8F1FA" }}>{det.rule}</span>
              <span style={{ fontSize: 13, color: "#D7DEE6", fontWeight: 500 }}>{ruleDef?.version}</span>
              <SeverityBadge severity={det.severity} />
              <StatusBadge status={det.status} />
              {det.observation_only ? <span style={{ fontSize: 10, color: "#D97A2B", background: "#102236", border: "1px solid #D97A2B", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>Observation only</span> : null}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#E8F1FA", marginBottom: 2 }}>{det.client_name}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>{det.cif}</span>
              <span>·</span>
              <CoverageChip seg={det.coverage_segment} />
              <span>·</span>
              <span>{det.detected_date}</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#D7DEE6", fontWeight: 500 }}>{ruleDef?.name} - Priority: {ruleDef?.priority}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 8 }}>EVALUATION FORMULA</div>
        <div style={{ padding: "10px 14px", background: "#0D1D2F", borderRadius: 8, fontSize: 12, color: "#D7DEE6", lineHeight: "18px", border: "1px solid #263544" }}>
          {ruleDef?.summary ?? det.description}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 8 }}>EXACT INPUTS & THRESHOLDS</div>
        <div style={{ border: "1px solid #263544", borderRadius: 8, overflow: "hidden" }}>
          {rows.map(([label, value, highlight], index) => {
            const rowBackground = index % 2 === 0 ? "#102236" : "#0D1D2F";
            const textColor = highlight ? accent : "#E8F1FA";
            const textWeight = highlight ? 700 : 500;
            return (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: rowBackground, borderBottom: index < rows.length - 1 ? "1px solid #263544" : "none" }}>
                <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: textWeight, color: textColor, textAlign: "right" }}>{value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {det.threshold_value !== "N/A" ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 8 }}>RESULT</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{det.evidence_label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{det.evidence_value}</span>
          </div>
          <div style={{ position: "relative", height: 8, background: "#0D1D2F", borderRadius: 4, border: "1px solid #263544" }}>
            <div style={{ width: `${valuePercent}%`, height: "100%", background: accent, borderRadius: 3, opacity: 0.75 }} />
            <div style={{ position: "absolute", top: -4, left: `${thresholdPercent}%`, width: 2, height: 16, background: "#9CA3AF", borderRadius: 1 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>
            <span>Observed</span>
            <span>Threshold: {det.threshold_value}</span>
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 8 }}>REASON CODE</div>
        <div style={{ padding: "8px 14px", background: "#0D1D2F", borderRadius: 8, borderLeft: `3px solid ${accent}`, fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.02em" }}>
          {reasonCode(det)}
        </div>
      </div>

      {history ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", marginBottom: 10 }}>DETECTION HISTORY</div>
          <div style={{ position: "relative", paddingLeft: 20 }}>
            <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 2, background: "#263544", borderRadius: 1 }} />
            {history.map((entry, index) => {
              let dotColor = "#9CA3AF";
              if (entry.state === "Active") dotColor = accent;
              if (entry.state === "Resolved") dotColor = "#2ECC71";
              let detail = "Rule not triggered this period";
              if (entry.decline_pct !== undefined) detail = `Volume decline ${entry.decline_pct}%`;
              else if (entry.growth_pct !== undefined) detail = `Growth ${entry.growth_pct}%`;
              else if (entry.reason) detail = entry.reason;
              return (
                <div key={`${entry.as_of}-${index}`} style={{ position: "relative", marginBottom: index < history.length - 1 ? 16 : 0, paddingLeft: 16 }}>
                  <div style={{ position: "absolute", left: -13, top: 4, width: 10, height: 10, borderRadius: "50%", background: dotColor, border: "2px solid #102236", boxShadow: `0 0 0 1px ${dotColor}` }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#D7DEE6" }}>{entry.as_of}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: dotColor }}>{entry.state}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {det.observation_only ? (
        <div style={{ padding: "10px 14px", background: "#0D1D2F", borderRadius: 8, fontSize: 11, color: "#D97A2B", borderLeft: "3px solid #D97A2B", lineHeight: "16px", fontWeight: 500, marginBottom: 12 }}>
          RULE-005 is observation-only. This detection must not be presented as a sales recommendation, CRM opportunity or RiskStatus change.
        </div>
      ) : null}

      <div style={{ padding: "10px 14px", background: "#0D1D2F", borderRadius: 8, fontSize: 10, color: "#9CA3AF", borderLeft: "3px solid #263544", lineHeight: "14px", fontWeight: 500 }}>
        Read-only observation. No assign, acknowledge, resolve, create-task, contact-client or recommendation controls.
      </div>
    </div>
  );
}

export default function DetectionPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Detection>(detections[0]);
  const [filter, setFilter] = useState<"All" | "High" | "Medium">("All");
  const [isNarrow, setIsNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)");
    const sync = () => {
      setIsNarrow(media.matches);
      if (!media.matches) setDrawerOpen(false);
    };
    sync();
    const handler = () => sync();
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const filtered = useMemo(() => {
    return detections.filter((item) => (filter === "All" ? true : item.severity === filter));
  }, [filter]);

  function selectDetection(det: Detection) {
    setSelected(det);
    if (isNarrow) setDrawerOpen(true);
  }

  const highCount = detections.filter((item) => item.severity === "High").length;
  const mediumCount = detections.filter((item) => item.severity === "Medium").length;
  const clientCount = new Set(detections.map((item) => item.cif)).size;

  if (isLoading) return <div className="h-full bg-[#0A1929]" />;

  return (
    <div className="h-full overflow-auto bg-[#0A1929] px-3 pb-4 pt-2" style={{ fontFamily: UI_FONT }}>
      <div className="rounded-lg border border-[#263544] bg-[#102236]">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #263544", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "#E8F1FA", margin: 0, lineHeight: "24px" }}>Detections</h1>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, fontWeight: 500 }}>Automated rule evaluations · Read-only observations · As of 2026-06-30</p>
          </div>
        </div>

        <div style={{ margin: "14px 18px 16px", border: "1px solid #263544", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", height: 80, background: "#263544", gap: 1 }}>
            {[
              { label: "Active", value: String(detections.length), color: "#E8F1FA" },
              { label: "High", value: String(highCount), color: "#FF4757" },
              { label: "Medium", value: String(mediumCount), color: "#F4B23A" },
              { label: "Named Clients", value: String(clientCount), color: "#D7DEE6" },
            ].map((item) => (
              <div key={item.label} style={{ flex: 1, padding: "0 20px", background: "#102236", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: item.color, lineHeight: "28px" }}>{item.value}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginTop: 1 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 18px", marginBottom: 16, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {(["All", "High", "Medium"] as const).map((value) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                style={{
                  padding: "3px 12px",
                  height: 32,
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: active ? "#2C5680" : "#263544",
                  background: active ? "#2C5680" : "#102236",
                  color: active ? "#FFFFFF" : "#D7DEE6",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: UI_FONT,
                }}
              >
                {value}
              </button>
            );
          })}
          <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginLeft: 4 }}>{filtered.length} detection{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "5fr 7fr", gap: 16, alignItems: "start" }}>
          <div style={{ border: "1px solid #263544", borderRadius: 10, overflow: "hidden" }}>
            {filtered.map((det) => (
              <DetectionListRow key={det.id} det={det} active={selected.id === det.id} onClick={() => selectDetection(det)} />
            ))}
            {filtered.length === 0 ? <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>No detections match the current filter.</div> : null}
          </div>

          {!isNarrow ? (
            <div style={{ border: "1px solid #263544", borderRadius: 10, overflow: "hidden", maxHeight: "calc(100vh - 260px)" }}>
              <EvidencePanel key={selected.id} det={selected} />
            </div>
          ) : null}
        </div>
      </div>

      {isNarrow && drawerOpen ? (
        <>
          <button type="button" aria-label="Close evidence drawer" onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,25,41,0.4)", border: "none", padding: 0, margin: 0, zIndex: 40, cursor: "pointer" }} />
          <dialog open className="drawer-slide-in" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(92vw, 560px)", background: "#102236", borderLeft: "1px solid #263544", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.25)", padding: 0, margin: 0, maxWidth: "none", maxHeight: "none", borderTop: "none", borderBottom: "none", borderRight: "none" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #263544", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#102236" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em" }}>EVIDENCE · {selected.rule}</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close evidence drawer" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #263544", background: "#0D1D2F", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <EvidencePanel key={`drawer-${selected.id}`} det={selected} />
            </div>
          </dialog>
        </>
      ) : null}
    </div>
  );
}
