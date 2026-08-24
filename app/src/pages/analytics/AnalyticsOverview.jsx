import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchWooStatus } from "../../api/woocommerce";
import { fetchAnalyticsTrends, fetchAnalyticsSummary } from "../../api/analytics";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsOverview({ onNavigate }) {
  const [connections, setConnections] = useState([]);
  const [trends, setTrends] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

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
    </div>
  );
}
