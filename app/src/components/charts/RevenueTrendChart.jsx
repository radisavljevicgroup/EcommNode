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

// showPrevious=false is what the always-on overview chart above the
// "Poređenje sa prošlom godinom" section uses now — that comparison lives
// in its own section further down (YearComparisonSection.jsx), so this
// chart went back to a single "Ova godina" line to stop showing the same
// comparison twice on one page. YearComparisonSection keeps the default
// (true).
export default function RevenueTrendChart({
  series,
  yoyPercent,
  currency,
  title = "Mesečni trendovi prihoda",
  showPrevious = true,
}) {
  const positive = yoyPercent !== null && yoyPercent >= 0;
  // Only draw the prior-year line when there's actually something to
  // compare against — a brand-new store with no history a year back would
  // otherwise show a flat line pinned at zero, which reads as a data bug
  // rather than "no data".
  const hasPrevious = showPrevious && series.some((p) => p.previousRevenue > 0);

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <h3>{title}</h3>
        {showPrevious && yoyPercent !== null && (
          <span className={"yoy-badge " + (positive ? "up" : "down")}>
            {positive ? "▲" : "▼"} {Math.abs(yoyPercent).toFixed(1)}% u odnosu na prošlu godinu
          </span>
        )}
      </div>
      {series.length === 0 ? (
        <div className="empty-hint">Nema podataka za izabrani period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} width={70} />
            <Tooltip
              formatter={(v, name) => [`${Math.round(v).toLocaleString("sr-RS")} ${currency}`, name]}
            />
            {hasPrevious && <Legend wrapperStyle={{ fontSize: 12 }} />}
            <Line
              type="monotone"
              dataKey="revenue"
              name="Ova godina"
              stroke="#480ca8"
              strokeWidth={2}
              dot={false}
            />
            {hasPrevious && (
              <Line
                type="monotone"
                dataKey="previousRevenue"
                name="Prošla godina"
                stroke="#480ca8"
                strokeWidth={2}
                strokeDasharray="5 5"
                strokeOpacity={0.45}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
