import { siteLabel } from "../utils/site";
import { formatKpiValue } from "../utils/format";

function formatRate(rate) {
  return rate == null ? "—" : `${rate.toFixed(1).replace(".", ",")} %`;
}

// One site's funnel (Meta Ads and GA4 "Levak po sajtu"). Each step's rate is
// against the previous step, the bar against the first step, and the hint
// says where the problem usually is when that rate is low. A step with
// `warnBelow` turns red under that rate.
export default function FunnelSteps({ steps, values, siteUrl, aside, topLabel = "Od prvog koraka" }) {
  const top = values[steps[0].key] || 0;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <strong style={{ color: "var(--text-dark)" }}>{siteLabel(siteUrl)}</strong>
        {aside && <span className="chart-subtitle">{aside}</span>}
      </div>
      <div className="orders-items-table-wrap">
        <table className="orders-items-table">
          <thead>
            <tr>
              <th>Korak</th>
              <th>Broj</th>
              <th>Od prethodnog</th>
              <th style={{ width: "30%" }}>{topLabel}</th>
              <th>Ako je nisko</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, i) => {
              const value = values[step.key] || 0;
              const prev = i > 0 ? values[steps[i - 1].key] || 0 : null;
              const rate = prev ? (value / prev) * 100 : null;
              const ofTop = top > 0 ? Math.min(100, (value / top) * 100) : 0;
              const warn = step.warnBelow != null && rate != null && rate < step.warnBelow;
              return (
                <tr key={step.key}>
                  <td className="gsc-key-cell">{step.label}</td>
                  <td>{formatKpiValue("integer", value)}</td>
                  <td style={warn ? { color: "#dc2626", fontWeight: 700 } : undefined}>
                    {i === 0 ? "—" : formatRate(rate)}
                  </td>
                  <td>
                    <div style={{ background: "var(--pill-bg)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                      <div style={{ width: `${ofTop}%`, height: "100%", background: "var(--purple)" }} />
                    </div>
                  </td>
                  <td className="chart-subtitle" style={{ fontWeight: 500 }}>
                    {step.hint}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
