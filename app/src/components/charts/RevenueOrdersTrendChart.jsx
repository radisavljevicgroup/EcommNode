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

// Revenue and order count on one chart, dual Y-axis (revenue left, orders
// right) since the two live on very different scales. showPrevious adds
// the same-calendar-month-last-year lines (dashed) on top of the current
// ones, reusing whatever [from, to] the caller already fetched — the
// series here always carries both current and previous-year values (see
// computeTrends in server/lib/analytics.js), so no extra fetch is needed
// to switch between the two.
export default function RevenueOrdersTrendChart({
  series,
  currency,
  title,
  subtitle,
  showPrevious = false,
}) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {subtitle && <p className="chart-subtitle">{subtitle}</p>}
      {!series || series.length === 0 ? (
        <div className="empty-hint">Nema podataka za izabrani period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="revenue"
              tick={{ fontSize: 12 }}
              width={70}
              tickFormatter={(v) => Math.round(v).toLocaleString("sr-RS")}
            />
            <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 12 }} width={50} />
            <Tooltip
              formatter={(v, name) =>
                name.startsWith("Porudžbine")
                  ? [Math.round(v).toLocaleString("sr-RS"), name]
                  : [`${Math.round(v).toLocaleString("sr-RS")} ${currency}`, name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              name="Promet — ova godina"
              stroke="#480ca8"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="orders"
              type="monotone"
              dataKey="orders"
              name="Porudžbine — ova godina"
              stroke="#e07a5f"
              strokeWidth={2}
              dot={false}
            />
            {showPrevious && (
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="previousRevenue"
                name="Promet — prošla godina"
                stroke="#480ca8"
                strokeWidth={2}
                strokeDasharray="5 5"
                strokeOpacity={0.45}
                dot={false}
              />
            )}
            {showPrevious && (
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="previousOrders"
                name="Porudžbine — prošla godina"
                stroke="#e07a5f"
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
