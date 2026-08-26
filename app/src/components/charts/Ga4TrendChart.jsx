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

export default function Ga4TrendChart({ series }) {
  return (
    <div className="chart-card">
      <h3>Sesije i aktivni korisnici kroz vreme</h3>
      {series.length === 0 ? (
        <div className="empty-hint">Nema podataka za izabrani period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
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
  );
}
