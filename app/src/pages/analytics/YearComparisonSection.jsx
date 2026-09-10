import { useEffect, useState } from "react";
import DateRangePicker, { isoDate, startOfMonth } from "../../components/DateRangePicker";
import RevenueTrendChart from "../../components/charts/RevenueTrendChart";
import InfoTooltip from "../../components/InfoTooltip";
import { fetchAnalyticsSummary, fetchYoyTrends } from "../../api/analytics";
import { KPI_QUADRANTS } from "../../constants/kpiDefinitions";
import { formatKpiValue } from "../../utils/format";

const COMPARE_MODES = [
  { key: "period", label: "Isti period" },
  { key: "month", label: "Isti mesec" },
  { key: "day", label: "Isti dan" },
];

const ALL_METRICS = KPI_QUADRANTS.flatMap((q) => q.metrics);

// Fully independent of SalesAnalysis.jsx's own filters/state above — only
// the brand selection (selectedIds) is shared, since picking "which
// stores" is one global concern. Everything about WHICH period to compare
// (and how granular the chart is) lives here, on its own state, so
// switching a mode here can't change what the KPI cards/chart above show.
export default function YearComparisonSection({ selectedIds }) {
  const [compareMode, setCompareMode] = useState("month");
  const [periodRange, setPeriodRange] = useState([isoDate(startOfMonth()), isoDate(new Date())]);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = isoDate(new Date());
  const [from, to] =
    compareMode === "month"
      ? [isoDate(startOfMonth()), today]
      : compareMode === "day"
      ? [today, today]
      : periodRange;

  const idsKey = selectedIds.join(",");

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSummary(null);
      setTrends(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      fetchAnalyticsSummary({ connectionIds: selectedIds, from, to, compare: true }),
      fetchYoyTrends({
        connectionIds: selectedIds,
        mode: compareMode,
        from,
        to,
        day: compareMode === "day" ? from : undefined,
      }),
    ])
      .then(([s, t]) => {
        if (cancelled) return;
        setSummary(s);
        setTrends(t);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, compareMode, from, to]);

  // RevenueTrendChart's x-axis field is literally named "month" (it was
  // built for the always-on monthly overview chart above) — reused as-is
  // here for daily/hourly labels too rather than forking the component
  // just to rename one prop key.
  const chartSeries = (trends?.series || []).map((p) => ({
    month: p.day || p.hour,
    revenue: p.revenue,
    previousRevenue: p.previousRevenue,
  }));
  const chartTitle = compareMode === "day" ? "Prihod po satu" : "Prihod po danu";

  return (
    <div className="yoy-section">
      <div className="settings-header">
        <h2 className="settings-title">Poređenje sa prošlom godinom</h2>
        <p className="settings-subtitle">
          Uporedi isti period, mesec ili dan sa istim periodom prošle godine — nezavisno od
          filtera iznad.
        </p>
      </div>

      <div className="analytics-filters">
        <div className="date-range-presets compare-mode-presets">
          {COMPARE_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={"date-range-preset" + (compareMode === m.key ? " active" : "")}
              onClick={() => setCompareMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {compareMode === "period" && (
          <DateRangePicker
            from={periodRange[0]}
            to={periodRange[1]}
            onChange={(f, t) => setPeriodRange([f, t])}
          />
        )}
      </div>

      {error && <div className="woo-error">{error}</div>}

      {selectedIds.length === 0 ? (
        <div className="empty-hint">Izaberi bar jedan brend iznad da bi video poređenje.</div>
      ) : (
        <>
          {trends && (
            <RevenueTrendChart
              series={chartSeries}
              yoyPercent={trends.yoyPercent}
              currency={summary?.currency || "RSD"}
              title={chartTitle}
            />
          )}

          <div className="yoy-metrics-grid">
            {ALL_METRICS.map((metric) => {
              const currency = summary?.[`${metric.key}Currency`] || summary?.currency || "RSD";
              const prevCurrency =
                summary?.previous?.[`${metric.key}Currency`] || summary?.previous?.currency || currency;
              return (
                <div className="yoy-metric-card" key={metric.key}>
                  <div className="yoy-metric-head">
                    <span className="quadrant-sub-label">{metric.label}</span>
                    <InfoTooltip text={metric.definition} />
                  </div>
                  <div className="yoy-metric-values">
                    <div className="yoy-metric-value-col">
                      <span className="yoy-metric-year">Ova godina</span>
                      <span className="yoy-metric-value">
                        {loading || !summary
                          ? "…"
                          : formatKpiValue(metric.format, summary[metric.key], currency)}
                      </span>
                    </div>
                    <div className="yoy-metric-value-col">
                      <span className="yoy-metric-year">Prošla godina</span>
                      <span className="yoy-metric-value yoy-metric-value-muted">
                        {loading || !summary
                          ? "…"
                          : formatKpiValue(metric.format, summary.previous?.[metric.key], prevCurrency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
