import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fetchWooStatus } from "../../api/woocommerce";
import { fetchAnalyticsTrends, fetchAnalyticsSummary } from "../../api/analytics";
import { fetchGa4Status, fetchGa4Performance } from "../../api/ga4";
import { fetchGscStatus, fetchGscPerformance } from "../../api/gsc";
import QuadrantCard from "../../components/QuadrantCard";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const GA4_METRICS = [
  { key: "sessions", label: "Sesije", format: "integer", definition: "Ukupan broj sesija (poseta) na sajtu u periodu." },
  {
    key: "activeUsers",
    label: "Aktivni korisnici",
    format: "integer",
    definition: "Broj jedinstvenih korisnika koji su posetili sajt u periodu.",
  },
  {
    key: "conversions",
    label: "Konverzije",
    format: "integer",
    definition: "Broj conversion (key event) akcija zabeleženih u GA4 u periodu.",
  },
  {
    key: "engagementRate",
    label: "Stopa angažovanosti",
    format: "percent",
    definition:
      "Procenat sesija koje GA4 smatra angažovanim (trajale duže od 10s, imale conversion događaj, ili 2+ pregleda stranice).",
  },
];

const GSC_METRICS = [
  { key: "clicks", label: "Klikovi", format: "integer", definition: "Ukupan broj klikova iz Google pretrage u periodu." },
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

export default function AnalyticsOverview({ onNavigate }) {
  const [connections, setConnections] = useState([]);
  const [trends, setTrends] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [ga4Connections, setGa4Connections] = useState([]);
  const [ga4Data, setGa4Data] = useState(null);
  const [ga4Loading, setGa4Loading] = useState(true);

  const [gscConnections, setGscConnections] = useState([]);
  const [gscData, setGscData] = useState(null);
  const [gscLoading, setGscLoading] = useState(true);

  useEffect(() => {
    fetchWooStatus()
      .then((data) => {
        const list = data.connections || [];
        setConnections(list);
        if (list.length === 0) return null;

        const to = isoDate(new Date());
        const from = isoDate(new Date(new Date().setMonth(new Date().getMonth() - 3)));
        const filters = { connectionIds: list.map((c) => c.id), from, to };

        return Promise.all([fetchAnalyticsTrends(filters), fetchAnalyticsSummary(filters)]).then(
          ([t, s]) => {
            setTrends(t);
            setSummary(s);
          }
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchGa4Status()
      .then((data) => {
        const list = data.connections || [];
        setGa4Connections(list);
        if (list.length === 0) return null;

        const to = isoDate(new Date());
        const from = isoDate(new Date(new Date().setMonth(new Date().getMonth() - 3)));
        return fetchGa4Performance(list[0].id, from, to).then(setGa4Data);
      })
      .catch(() => {})
      .finally(() => setGa4Loading(false));
  }, []);

  useEffect(() => {
    fetchGscStatus()
      .then((data) => {
        const list = data.connections || [];
        setGscConnections(list);
        if (list.length === 0) return null;

        const to = isoDate(new Date());
        const from = isoDate(new Date(new Date().setMonth(new Date().getMonth() - 3)));
        return fetchGscPerformance(list[0].id, from, to).then(setGscData);
      })
      .catch(() => {})
      .finally(() => setGscLoading(false));
  }, []);

  return (
    <div className="analytics-page">
      <div className="settings-header">
        <h1 className="settings-title">Analitika</h1>
        <p className="settings-subtitle">
          Pregled poslovanja preko svih povezanih WooCommerce prodavnica.
        </p>
      </div>

      {connections.length === 0 ? (
        <div className="empty-hint">
          Poveži WooCommerce u Podešavanja → Integracije da bi video analitiku.
        </div>
      ) : (
        <div className="chart-card">
          <div className="chart-card-head">
            <h3>Analiza prodaje</h3>
            <button
              type="button"
              className="performance-link"
              onClick={() => onNavigate("analiza-prodaje")}
            >
              Kompletan izveštaj →
            </button>
          </div>
          <p className="chart-subtitle">
            {loading
              ? "Učitavanje…"
              : `Ukupno ${summary?.orderCount ?? 0} porudžbina u poslednja 3 meseca`}
          </p>
          {!loading && trends?.series?.length === 0 ? (
            <div className="empty-hint">Nema podataka za poslednja 3 meseca.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends?.series || []}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={70} />
                <Tooltip
                  formatter={(v) =>
                    `${Math.round(v).toLocaleString("sr-RS")} ${summary?.currency || "RSD"}`
                  }
                />
                <Line type="monotone" dataKey="revenue" stroke="#480ca8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {ga4Connections.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-head">
            <h3>Google Analytics</h3>
            <button
              type="button"
              className="performance-link"
              onClick={() => onNavigate("google-analytics")}
            >
              Kompletan izveštaj →
            </button>
          </div>

          <div className="overview-quadrant-wrap">
            <QuadrantCard metrics={GA4_METRICS} values={ga4Data?.totals} loading={ga4Loading} wide bare />
          </div>

          {!ga4Loading && ga4Data?.trend?.length === 0 ? (
            <div className="empty-hint">Nema podataka za poslednja 3 meseca.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ga4Data?.trend || []}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={60} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name="Sesije"
                  stroke="#480ca8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  name="Aktivni korisnici"
                  stroke="#9d8189"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {gscConnections.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-head">
            <h3>Google Search Console</h3>
            <button
              type="button"
              className="performance-link"
              onClick={() => onNavigate("search-console")}
            >
              Kompletan izveštaj →
            </button>
          </div>

          <div className="overview-quadrant-wrap">
            <QuadrantCard metrics={GSC_METRICS} values={gscData?.totals} loading={gscLoading} wide bare />
          </div>

          {!gscLoading && gscData?.trend?.length === 0 ? (
            <div className="empty-hint">Nema podataka za poslednja 3 meseca.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={gscData?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} width={60} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="clicks"
                  name="Klikovi"
                  stroke="#480ca8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  name="Prikazi"
                  stroke="#9d8189"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
