import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { CloseIcon } from "../icons";
import { fetchMetricTrend } from "../api/analytics";
import { formatKpiValue } from "../utils/format";

export default function MetricTrendModal({ metric, connectionIds, from, to, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchMetricTrend(metric.key, { connectionIds, from, to })
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
  }, [metric.key, connectionIds, from, to]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card metric-trend-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Zatvori">
          <CloseIcon />
        </button>
        <h2 className="modal-title">{metric.label}</h2>
        <p className="modal-subtitle">{metric.definition}</p>

        {loading ? (
          <div className="empty-hint">Učitavanje…</div>
        ) : error ? (
          <div className="woo-error">{error}</div>
        ) : data.series.length === 0 ? (
          <div className="empty-hint">Nema podataka za izabrani period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} width={70} />
              <Tooltip formatter={(v) => formatKpiValue(metric.format, v, data.currency)} />
              <Bar dataKey="value" fill="#480ca8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
