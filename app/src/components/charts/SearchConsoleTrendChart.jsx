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

export default function SearchConsoleTrendChart({ series }) {
  return (
    <div className="chart-card">
      <h3>Klikovi i prikazi kroz vreme</h3>
      {series.length === 0 ? (
        <div className="empty-hint">Nema podataka za izabrani period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
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
  );
}
