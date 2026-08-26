import { useEffect, useState } from "react";
import { fetchGa4Status, fetchGa4Performance } from "../../api/ga4";
import QuadrantCard from "../../components/QuadrantCard";
import Ga4TrendChart from "../../components/charts/Ga4TrendChart";
import DateRangePicker, { PRESETS } from "../../components/DateRangePicker";
import { siteLabel } from "../../utils/site";

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

export default function GoogleAnalytics() {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [range, setRange] = useState(YEAR_PRESET.range);
  const [data, setData] = useState(null);
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
