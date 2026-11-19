import { useState } from "react";
import { siteLabel } from "../utils/site";
import { formatKpiValue } from "../utils/format";

function formatRate(rate, digits = 1) {
  return rate == null ? "—" : `${rate.toFixed(digits).replace(".", ",")} %`;
}

const OK = "#16a34a";
const LOW = "#dc2626";

// Each step (after the first) is judged against `benchmark`: the rough
// minimum rate from the previous step a healthy store reaches. Below it the
// step is "Nisko" with its `problem`; the step furthest under its benchmark
// is the funnel's main problem. A step at 0 means the event isn't arriving
// at all (not tracked), which is said as such instead of "Nisko".
function evaluate(steps, values) {
  const rows = steps.map((step, i) => {
    const value = values[step.key] || 0;
    const prev = i > 0 ? values[steps[i - 1].key] || 0 : null;
    const rate = i > 0 && prev > 0 ? (value / prev) * 100 : null;
    let status = null;
    if (i > 0) {
      if (value === 0) status = "missing";
      else if (rate == null) status = null;
      else status = step.benchmark != null && rate < step.benchmark ? "low" : "ok";
    }
    return { step, value, rate, status };
  });
  let worst = null;
  rows.forEach((r) => {
    if (r.status !== "low") return;
    const gap = r.rate / r.step.benchmark;
    if (!worst || gap < worst.gap) worst = { ...r, gap };
  });
  return { rows, worst };
}

function StatusCell({ row, isWorst }) {
  if (row.status === "missing") {
    return (
      <span style={{ color: "var(--text-muted)" }}>
        Događaj ne stiže — proveri da li ga pixel/sajt šalje.
      </span>
    );
  }
  if (row.status === "low") {
    return (
      <span>
        <strong style={{ color: LOW }}>{isWorst ? "Najveći problem" : "Nisko"}</strong>
        <span style={{ color: "var(--text-muted)" }}> (orijentir ≥ {row.step.benchmark} %)</span>
        <br />
        {row.step.problem}
      </span>
    );
  }
  if (row.status === "ok") {
    return (
      <span>
        <strong style={{ color: OK }}>U redu</strong>
        {row.step.benchmark != null && (
          <span style={{ color: "var(--text-muted)" }}> (orijentir ≥ {row.step.benchmark} %)</span>
        )}
      </span>
    );
  }
  return <span style={{ color: "var(--text-muted)" }}>{row.step.hint || "—"}</span>;
}

// One site's funnel (Meta Ads and GA4 "Levak po sajtu"), collapsed to a
// one-line summary until opened.
export default function FunnelSteps({ steps, values, siteUrl, aside, topLabel = "Od prvog koraka", topNoun, lastNoun }) {
  const [open, setOpen] = useState(false);
  const { rows, worst } = evaluate(steps, values);
  const top = rows[0].value;
  const last = rows[rows.length - 1].value;
  const missing = rows.filter((r) => r.status === "missing").length;

  let verdict;
  if (worst) {
    verdict = (
      <span style={{ color: LOW, fontWeight: 600 }}>
        Najslabije: {steps[steps.indexOf(worst.step) - 1].label} → {worst.step.label} ({formatRate(worst.rate)})
      </span>
    );
  } else if (missing) {
    verdict = <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Ne stiže {missing} od {steps.length - 1} događaja</span>;
  } else {
    verdict = <span style={{ color: OK, fontWeight: 600 }}>Svi koraci u redu</span>;
  }

  return (
    <details
      style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "6px 16px",
        }}
      >
        <strong style={{ color: "var(--text-dark)", minWidth: 120 }}>
          <span
            style={{
              display: "inline-block",
              width: 14,
              color: "var(--text-muted)",
              transition: "transform .15s",
              transform: open ? "rotate(90deg)" : "none",
            }}
          >
            ▸
          </span>
          {siteLabel(siteUrl)}
        </strong>
        <span className="chart-subtitle">
          {formatKpiValue("integer", top)} {topNoun} → {formatKpiValue("integer", last)} {lastNoun} (
          {formatRate(top > 0 ? (last / top) * 100 : null, 2)})
        </span>
        <span className="chart-subtitle">{verdict}</span>
        {aside && (
          <span className="chart-subtitle" style={{ marginLeft: "auto" }}>
            {aside}
          </span>
        )}
      </summary>
      <div className="orders-items-table-wrap" style={{ marginTop: 10 }}>
        <table className="orders-items-table" style={{ tableLayout: "fixed", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ width: "17%" }}>Korak</th>
              <th style={{ width: "9%" }}>Broj</th>
              <th style={{ width: "13%" }}>Od prethodnog</th>
              <th style={{ width: "24%" }}>{topLabel}</th>
              <th>Procena</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const ofTop = top > 0 ? (row.value / top) * 100 : null;
              return (
                <tr key={row.step.key}>
                  <td className="gsc-key-cell">{row.step.label}</td>
                  <td>{formatKpiValue("integer", row.value)}</td>
                  <td style={row.status === "low" ? { color: LOW, fontWeight: 700 } : undefined}>
                    {i === 0 ? "—" : formatRate(row.rate)}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{ flex: 1, background: "var(--pill-bg)", borderRadius: 4, height: 10, overflow: "hidden" }}
                      >
                        <div
                          style={{ width: `${Math.min(100, ofTop || 0)}%`, height: "100%", background: "var(--purple)" }}
                        />
                      </div>
                      <span style={{ minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {formatRate(ofTop)}
                      </span>
                    </div>
                  </td>
                  <td className="chart-subtitle" style={{ fontWeight: 500 }}>
                    <StatusCell row={row} isWorst={worst && worst.step === row.step} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
