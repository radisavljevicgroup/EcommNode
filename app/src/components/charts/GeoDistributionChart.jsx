import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function GeoDistributionChart({ data, currency }) {
  return (
    <div className="chart-card">
      <h3>Geografska i segmentna raspodela</h3>
      <p className="chart-subtitle">Prihod po gradu</p>
      {data.length === 0 ? (
        <div className="empty-hint">Nema podataka za izabrani period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={100} />
            <Tooltip formatter={(v) => `${Math.round(v).toLocaleString("sr-RS")} ${currency}`} />
            <Bar dataKey="revenue" fill="#7209b7" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="channel-note">
        <strong>Kanali akvizicije i tip uređaja:</strong> podaci nisu dostupni — WooCommerce
        podrazumevano ne prati ove informacije bez posebnog tracking plugin-a.
      </div>
    </div>
  );
}
