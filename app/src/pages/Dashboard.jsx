import { useEffect, useState } from "react";
import { fetchWooStatus } from "../api/woocommerce";
import { fetchShopifyStatus } from "../api/shopify";
import { fetchDashboardSummary, fetchDashboardAnomalies } from "../api/dashboard";
import { formatKpiValue } from "../utils/format";
import { siteLabel } from "../utils/site";

const PERIOD_DAYS = 7;

function DeltaBadge({ changePercent }) {
  if (changePercent === null || changePercent === undefined) {
    return <span className="home-kpi-delta neutral">bez poređenja</span>;
  }
  const positive = changePercent >= 0;
  return (
    <span className={"home-kpi-delta " + (positive ? "positive" : "negative")}>
      {positive ? "▲" : "▼"} {Math.abs(changePercent).toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, changePercent, hint }) {
  return (
    <div className="home-kpi-card">
      <p className="home-kpi-label">{label}</p>
      <p className="home-kpi-value">{value}</p>
      <div className="home-kpi-footer">
        <DeltaBadge changePercent={changePercent} />
        {hint && <span className="home-kpi-hint">{hint}</span>}
      </div>
    </div>
  );
}

function ComboKpiCard({ label, primary, secondary, hint }) {
  return (
    <div className="home-kpi-card">
      <p className="home-kpi-label">{label}</p>
      <div className="home-kpi-combo">
        <div className="home-kpi-combo-stat">
          <p className="home-kpi-combo-value">{primary.value}</p>
          <p className="home-kpi-combo-label">{primary.label}</p>
          <DeltaBadge changePercent={primary.changePercent} />
        </div>
        <div className="home-kpi-combo-stat">
          <p className="home-kpi-combo-value">{secondary.value}</p>
          <p className="home-kpi-combo-label">{secondary.label}</p>
          <DeltaBadge changePercent={secondary.changePercent} />
        </div>
      </div>
      {hint && <p className="home-kpi-hint home-kpi-hint-block">{hint}</p>}
    </div>
  );
}

const SEVERITY_LABEL = { critical: "Kritično", warning: "Upozorenje" };

function AnomalyCard({ anomaly, fallbackCurrency }) {
  return (
    <div className={"anomaly-card anomaly-" + anomaly.severity}>
      <span className="anomaly-severity-pill">{SEVERITY_LABEL[anomaly.severity] || anomaly.severity}</span>
      <div className="anomaly-body">
        <p className="anomaly-message">{anomaly.message}</p>
        {anomaly.estimatedImpact != null && (
          <p className="anomaly-impact">
            Procenjeni gubitak: ~
            {formatKpiValue("currency", anomaly.estimatedImpact, anomaly.currency || fallbackCurrency)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [checkingStores, setCheckingStores] = useState(true);
  const [connections, setConnections] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [summary, setSummary] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchWooStatus(), fetchShopifyStatus()])
      .then(([woo, shopify]) => {
        setConnections([...(woo.connections || []), ...(shopify.connections || [])]);
      })
      .catch(() => {})
      .finally(() => setCheckingStores(false));
  }, []);

  const hasStores = connections.length > 0;

  useEffect(() => {
    if (checkingStores || !hasStores) return;
    setLoading(true);
    setError("");
    Promise.all([
      fetchDashboardSummary(PERIOD_DAYS, selectedBrand),
      fetchDashboardAnomalies(PERIOD_DAYS, selectedBrand),
    ])
      .then(([summaryData, anomalyData]) => {
        setSummary(summaryData);
        setAnomalies(anomalyData.anomalies || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [checkingStores, hasStores, selectedBrand]);

  const hint = `vs prethodnih ${PERIOD_DAYS} dana`;

  return (
    <div className="page-body home-page">
      <div className="settings-header">
        <h1 className="settings-title">Stanje poslovanja</h1>
        <p className="settings-subtitle">Poslednjih {PERIOD_DAYS} dana u odnosu na prethodni period.</p>
      </div>

      {checkingStores ? null : !hasStores ? (
        <div className="empty-hint">
          Poveži WooCommerce ili Shopify prodavnicu u Podešavanja → Integracije da bi video pregled poslovanja.
        </div>
      ) : (
        <>
          {connections.length > 1 && (
            <label className="per-page-select home-brand-select">
              Brend
              <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
                <option value="">Svi brendovi</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {siteLabel(c.siteUrl)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <div className="woo-error">{error}</div>}

          <div className="home-kpi-grid">
            <KpiCard
              label="Ukupan prihod"
              value={loading ? "…" : formatKpiValue("currency", summary?.revenue.current, summary?.currency)}
              changePercent={summary?.revenue.changePercent}
              hint={hint}
            />

            <ComboKpiCard
              label="Porudžbine i prosečna vrednost korpe"
              primary={{
                label: "Broj porudžbina",
                value: loading ? "…" : formatKpiValue("integer", summary?.orders.current),
                changePercent: summary?.orders.changePercent,
              }}
              secondary={{
                label: "AOV",
                value: loading ? "…" : formatKpiValue("currency", summary?.aov.current, summary?.currency),
                changePercent: summary?.aov.changePercent,
              }}
              hint={hint}
            />

            <ComboKpiCard
              label="Trošak oglašavanja (Meta)"
              primary={{
                label: "Potrošnja",
                value: loading
                  ? "…"
                  : formatKpiValue("currency", summary?.adSpend.current, summary?.metaCurrency || summary?.currency),
                changePercent: summary?.adSpend.changePercent,
              }}
              secondary={{
                label: "ROAS",
                value: loading || summary?.roas.current == null ? "—" : `${summary.roas.current.toFixed(2)}x`,
                changePercent: summary?.roas.changePercent,
              }}
              hint={hint}
            />

            <KpiCard
              label="Ukupna stopa konverzije"
              value={
                loading
                  ? "…"
                  : summary?.conversionRate.current == null
                    ? "—"
                    : formatKpiValue("percent", summary.conversionRate.current)
              }
              changePercent={summary?.conversionRate.changePercent}
              hint={hint}
            />
          </div>

          <div className="settings-header home-anomalies-header">
            <h2 className="home-section-title">Gde gubimo novac</h2>
            <p className="settings-subtitle">Kritične stavke iz poslednjih {PERIOD_DAYS} dana koje direktno utiču na prihod.</p>
          </div>

          {loading ? (
            <div className="empty-hint">Skeniranje anomalija…</div>
          ) : !anomalies?.length ? (
            <div className="empty-hint">Nema uočenih problema u poslednjih {PERIOD_DAYS} dana.</div>
          ) : (
            <div className="anomaly-list">
              {anomalies.map((a) => (
                <AnomalyCard key={a.id} anomaly={a} fallbackCurrency={summary?.currency} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
