import { useEffect, useState } from "react";
import { fetchGscStatus, fetchGscPerformance } from "../../api/gsc";
import QuadrantCard from "../../components/QuadrantCard";
import SearchConsoleTrendChart from "../../components/charts/SearchConsoleTrendChart";
import DateRangePicker, { PRESETS } from "../../components/DateRangePicker";
import { siteLabel } from "../../utils/site";

const YEAR_PRESET = PRESETS.find((p) => p.key === "year");

const METRICS = [
  {
    key: "clicks",
    label: "Klikovi",
    format: "integer",
    definition: "Ukupan broj klikova iz Google pretrage u izabranom periodu.",
  },
  {
    key: "impressions",
    label: "Prikazi",
    format: "integer",
    definition: "Koliko puta se sajt pojavio u rezultatima Google pretrage.",
  },
  {
    key: "ctr",
    label: "CTR",
    format: "percent",
    definition: "Klikovi podeljeni sa prikazima — procenat ljudi koji su kliknuli kad su videli sajt u pretrazi.",
  },
  {
    key: "position",
    label: "Prosečna pozicija",
    format: "decimal",
    definition: "Prosečna pozicija sajta u rezultatima pretrage (manji broj znači bolju poziciju).",
  },
];

function TopTable({ title, subtitle, rows, rowKey, columnLabel, loading }) {
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
                <th>Klikovi</th>
                <th>Prikazi</th>
                <th>CTR</th>
                <th>Pozicija</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[rowKey]}>
                  <td className="gsc-key-cell">{row[rowKey]}</td>
                  <td>{row.clicks.toLocaleString("sr-RS")}</td>
                  <td>{row.impressions.toLocaleString("sr-RS")}</td>
                  <td>{row.ctr.toFixed(1)}%</td>
                  <td>{row.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SearchConsole() {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [range, setRange] = useState(YEAR_PRESET.range);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [from, to] = range;

  useEffect(() => {
    fetchGscStatus()
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
    fetchGscPerformance(selectedId, from, to)
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
        <h1 className="settings-title">Google Search Console</h1>
        <p className="settings-subtitle">
          Performanse u Google pretrazi za povezane sajtove.
        </p>
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
            title="Pretraga"
            metrics={METRICS}
            values={data?.totals}
            loading={loading}
            wide
          />

          <SearchConsoleTrendChart series={data?.trend || []} />

          <TopTable
            title="Top upiti"
            subtitle="Deset upita sa najviše klikova"
            rows={data?.topQueries || []}
            rowKey="query"
            columnLabel="Upit"
            loading={loading}
          />

          <TopTable
            title="Top stranice"
            subtitle="Deset stranica sa najviše klikova"
            rows={data?.topPages || []}
            rowKey="page"
            columnLabel="Stranica"
            loading={loading}
          />
        </>
      )}
    </div>
  );
}
