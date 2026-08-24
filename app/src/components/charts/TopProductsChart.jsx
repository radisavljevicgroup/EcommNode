import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#480ca8", "#7209b7", "#9d4edd", "#c77dff", "#e0aaff", "#3c096c", "#5a189a", "#240046"];

function truncate(name, max = 22) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export default function TopProductsChart({ bestsellers, categories, currency }) {
  const bars = bestsellers.map((p) => ({ ...p, shortName: truncate(p.name) }));

  return (
    <div className="chart-card">
      <h3>Top proizvodi i kategorije</h3>
      <div className="chart-split">
        <div>
          <p className="chart-subtitle">Bestseller proizvodi</p>
          {bars.length === 0 ? (
            <div className="empty-hint">Nema podataka.</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={bars} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="shortName" tick={{ fontSize: 10.5 }} width={150} />
                <Tooltip
                  formatter={(v) => `${Math.round(v).toLocaleString("sr-RS")} ${currency}`}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label}
                />
                <Bar dataKey="revenue" fill="#480ca8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div>
          <p className="chart-subtitle">Udeo kategorija u prihodu</p>
          {categories.length === 0 ? (
            <div className="empty-hint">Nema podataka.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categories} dataKey="revenue" nameKey="name" innerRadius={50} outerRadius={90}>
                  {categories.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => `${Math.round(v).toLocaleString("sr-RS")} ${currency}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
