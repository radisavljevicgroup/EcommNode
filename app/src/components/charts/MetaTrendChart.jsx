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

export default function MetaTrendChart({ series, currency = "RSD" }) {
  return (
    <div className="chart-card">
      <h3>Potrošnja i klikovi kroz vreme</h3>
      {series.length === 0 ? (
        <div className="empty-hint">Nema podataka za izabrani period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} width={70} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} width={60} />
            <Tooltip
              formatter={(v, name) =>
                name === "Potrošnja" ? `${Math.round(v).toLocaleString("sr-RS")} ${currency}` : v
              }
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="spend"
              name="Potrošnja"
              stroke="#480ca8"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="clicks"
              name="Klikovi"
              stroke="#9d8189"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
