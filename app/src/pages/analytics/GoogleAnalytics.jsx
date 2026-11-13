import { useEffect, useState } from "react";
import { fetchGa4Status, fetchGa4Performance, fetchGa4Insights } from "../../api/ga4";
import QuadrantCard from "../../components/QuadrantCard";
import Ga4TrendChart from "../../components/charts/Ga4TrendChart";
import DateRangePicker, { PRESETS } from "../../components/DateRangePicker";
import { siteLabel } from "../../utils/site";
import { formatKpiValue } from "../../utils/format";

const YEAR_PRESET = PRESETS.find((p) => p.key === "year");

const METRICS = [
  {
    key: "sessions",
    label: "Sesije",
    format: "integer",
    definition: "Ukupan broj sesija (poseta) na sajtu u izabranom periodu.",
  },
  {
    key: "activeUsers",
    label: "Aktivni korisnici",
    format: "integer",
    definition: "Broj jedinstvenih korisnika koji su posetili sajt u izabranom periodu.",
  },
  {
    key: "conversions",
    label: "Konverzije",
    format: "integer",
    definition: "Broj conversion (key event) akcija zabeleženih u GA4 u izabranom periodu.",
  },
  {
    key: "engagementRate",
    label: "Stopa angažovanosti",
    format: "percent",
    definition:
      "Procenat sesija koje GA4 smatra angažovanim (trajale duže od 10s, imale conversion događaj, ili 2+ pregleda stranice).",
  },
];

function TopTable({ title, subtitle, rows, rowKey, columnLabel, secondaryLabel, loading }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <p className="chart-subtitle">{subtitle}</p>
      {rows.length === 0 ? (
        <div className="empty-hint">{loading ? "Učitavanje…" : "Nema podataka."}</div>
      ) : (
        <div className="orders-items-table-wrap">
          <table className="orders-items-table">
            <thead>
              <tr>
                <th>{columnLabel}</th>
                <th>Sesije</th>
                <th>{secondaryLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[rowKey]}>
                  <td className="gsc-key-cell">{row[rowKey]}</td>
                  <td>{row.sessions.toLocaleString("sr-RS")}</td>
                  <td>{(row.views ?? row.activeUsers ?? 0).toLocaleString("sr-RS")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function pct(value) {
  return value == null ? "—" : `${value.toLocaleString("sr-RS", { maximumFractionDigits: 1 })}%`;
}

// A drop of this much (relative) in a device's conversion rate vs. the
// previous period of the same length is flagged — the "did an update break
// mobile checkout" check from the daily routine.
const DEVICE_DROP_ALERT = -20;

function DeviceTable({ insights, loading }) {
  const data = insights?.devices;
  const rows = data?.devices || [];
  const basisLabel = data?.basis === "conversions" ? "Konverzije" : "Kupovine";
  return (
    <div className="chart-card">
      <h3>Konverzija po uređaju</h3>
      <p className="chart-subtitle">
        Mobilni vs. desktop u odnosu na prethodni period iste dužine — nagli pad na jednom uređaju
        obično znači da je neki update pokvario prikaz ili plaćanje baš tamo
        {data?.basis === "conversions" &&
          " (GA4 nema e-commerce purchase događaje, pa se računa preko key event konverzija)"}
      </p>
      {data?.error ? (
        <div className="empty-hint">GA4 nije vratio podatke po uređaju: {data.error}</div>
      ) : rows.length === 0 ? (
        <div className="empty-hint">{loading ? "Učitavanje…" : "Nema podataka."}</div>
      ) : (
        <div className="orders-items-table-wrap">
          <table className="orders-items-table">
            <thead>
              <tr>
                <th>Uređaj</th>
                <th>Sesije</th>
                <th>Udeo</th>
                <th>{basisLabel}</th>
                <th>Stopa konverzije</th>
                <th>Prethodni period</th>
                <th>Promena</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const dropped = d.changePercent != null && d.changePercent <= DEVICE_DROP_ALERT;
                return (
                  <tr key={d.device}>
                    <td className="gsc-key-cell">{d.label}</td>
                    <td>{formatKpiValue("integer", d.sessions)}</td>
                    <td>{pct(d.sessionShare)}</td>
                    <td>{formatKpiValue("integer", d.orders)}</td>
                    <td>{pct(d.conversionRate)}</td>
                    <td>{pct(d.previousConversionRate)}</td>
                    <td style={dropped ? { color: "#c0392b", fontWeight: 600 } : undefined}>
                      {d.changePercent == null
                        ? "—"
                        : `${d.changePercent > 0 ? "+" : ""}${pct(d.changePercent)}`}
                      {dropped && " ⚠"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductRows({ rows, emptyText }) {
  if (!rows.length) return <div className="empty-hint">{emptyText}</div>;
  return (
    <div className="orders-items-table-wrap">
      <table className="orders-items-table">
        <thead>
          <tr>
            <th>Proizvod</th>
            <th>Pregledi</th>
            <th>U korpu</th>
            <th>Kupljeno</th>
            <th>Pregled → korpa</th>
            <th>Pregled → kupovina</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.name}>
              <td className="gsc-key-cell">{p.name}</td>
              <td>{formatKpiValue("integer", p.views)}</td>
              <td>{formatKpiValue("integer", p.addedToCart)}</td>
              <td>{formatKpiValue("integer", p.purchased)}</td>
              <td>{pct(p.viewToCartRate)}</td>
              <td>{pct(p.viewToPurchaseRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PRODUCT_TABS = [
  {
    key: "weak",
    label: "Puno pregleda, slaba prodaja",
    hint: "Proveri sliku, opis i cenu — ljudi gledaju, ali ne kupuju.",
    field: "weakSellers",
  },
  {
    key: "winners",
    label: "Skriveni pobednici",
    hint: "Visoka konverzija, malo pregleda — guraj ih na početnu, u prvi red kategorije i u newsletter.",
    field: "hiddenWinners",
  },
  {
    key: "top",
    label: "Najgledaniji",
    hint: "Proizvodi sa najviše pregleda u periodu.",
    field: "topViewed",
  },
];

function ProductInsights({ insights, loading }) {
  const [tab, setTab] = useState("weak");
  const data = insights?.products;
  const active = PRODUCT_TABS.find((t) => t.key === tab);
  const rows = data?.[active.field] || [];

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>Pregledi vs. prodaja po proizvodu</h3>
          <p className="chart-subtitle">
            {data && !data.error && data.productCount > 0
              ? `Prosečna stopa pregled → kupovina na sajtu: ${pct(data.averageViewToPurchaseRate)} · ` +
                `računa se samo za proizvode sa bar ${data.minViewsForRate} pregleda`
              : "Iz GA4 e-commerce događaja (view_item, add_to_cart, purchase)"}
          </p>
        </div>
        <div className="filter-tabs">
          {PRODUCT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={"filter-tab" + (tab === t.key ? " active" : "")}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {data?.error ? (
        <div className="empty-hint">GA4 nije vratio podatke po proizvodu: {data.error}</div>
      ) : !data ? (
        <div className="empty-hint">{loading ? "Učitavanje…" : "Nema podataka."}</div>
      ) : data.productCount === 0 ? (
        <div className="empty-hint">
          GA4 nema podatke po proizvodu za ovaj period — sajt verovatno ne šalje e-commerce
          događaje (view_item / purchase sa listom artikala).
        </div>
      ) : (
        <>
          <p className="chart-subtitle">{active.hint}</p>
          <ProductRows rows={rows} emptyText="Nema proizvoda u ovoj grupi za izabrani period." />
        </>
      )}
    </div>
  );
}

export default function GoogleAnalytics() {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [range, setRange] = useState(YEAR_PRESET.range);
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [from, to] = range;

  useEffect(() => {
    fetchGa4Status()
      .then((res) => {
        const list = res.connections || [];
        setConnections(list);
        setSelectedId(list[0]?.id || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchGa4Performance(selectedId, from, to)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, from, to]);

  // Separate request so a slow or failing e-commerce report never holds up
  // or breaks the main traffic numbers above it.
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    setInsightsLoading(true);
    setInsights(null);
    fetchGa4Insights(selectedId, from, to)
      .then((res) => {
        if (!cancelled) setInsights(res);
      })
      .catch((err) => {
        if (!cancelled) setInsights({ products: { error: err.message }, devices: { error: err.message } });
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, from, to]);

  return (
    <div className="analytics-page">
      <div className="settings-header">
        <h1 className="settings-title">Google Analytics 4</h1>
        <p className="settings-subtitle">Saobraćaj i konverzije za povezane sajtove.</p>
      </div>

      <div className="analytics-filters">
        {connections.length > 1 && (
          <label className="per-page-select">
            Sajt
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {siteLabel(c.targetSiteUrl)}
                </option>
              ))}
            </select>
          </label>
        )}
        <DateRangePicker from={from} to={to} onChange={(f, t) => setRange([f, t])} />
      </div>

      {error ? (
        <div className="woo-error">{error}</div>
      ) : (
        <>
          <QuadrantCard
            title="Saobraćaj i konverzije"
            metrics={METRICS}
            values={data?.totals}
            loading={loading}
            wide
          />

          <Ga4TrendChart series={data?.trend || []} />

          <DeviceTable insights={insights} loading={insightsLoading} />

          <ProductInsights insights={insights} loading={insightsLoading} />

          <TopTable
            title="Top stranice"
            subtitle="Deset stranica sa najviše pregleda"
            rows={data?.topPages || []}
            rowKey="page"
            columnLabel="Stranica"
            secondaryLabel="Pregledi"
            loading={loading}
          />

          <TopTable
            title="Top kanali"
            subtitle="Deset kanala saobraćaja sa najviše sesija"
            rows={data?.topChannels || []}
            rowKey="channel"
            columnLabel="Kanal"
            secondaryLabel="Korisnici"
            loading={loading}
          />
        </>
      )}
    </div>
  );
}
