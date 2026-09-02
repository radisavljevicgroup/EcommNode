import { useEffect, useState } from "react";
import { fetchMetaStatus, fetchMetaPerformance } from "../../api/meta";
import QuadrantCard from "../../components/QuadrantCard";
import MetaTrendChart from "../../components/charts/MetaTrendChart";
import DateRangePicker, { PRESETS } from "../../components/DateRangePicker";
import { siteLabel } from "../../utils/site";
import { formatKpiValue } from "../../utils/format";
import Pagination from "../../components/Pagination";

const YEAR_PRESET = PRESETS.find((p) => p.key === "year");

const METRICS = [
  {
    key: "spend",
    label: "Potrošnja",
    format: "currency",
    definition: "Ukupno potrošeno na Meta oglase u izabranom periodu.",
  },
  {
    key: "impressions",
    label: "Prikazi",
    format: "integer",
    definition: "Koliko puta su se oglasi prikazali u izabranom periodu.",
  },
  {
    key: "clicks",
    label: "Klikovi",
    format: "integer",
    definition: "Ukupan broj klikova na oglase u izabranom periodu.",
  },
  {
    key: "ctr",
    label: "CTR",
    format: "percent",
    definition: "Klikovi podeljeni sa prikazima.",
  },
  {
    key: "cpc",
    label: "CPC",
    format: "currency",
    definition: "Prosečna cena po kliku (Potrošnja / Klikovi).",
  },
  {
    key: "purchases",
    label: "Kupovine",
    format: "integer",
    definition: "Broj kupovina koje Meta pripisuje oglasima (purchase pixel/CAPI događaj).",
  },
  {
    key: "cpa",
    label: "CPA",
    format: "currency",
    definition: "Prosečna cena po kupovini (Potrošnja / Kupovine) — Cost Per Acquisition.",
  },
  {
    key: "cac",
    label: "CAC",
    format: "currency",
    definition:
      "Customer Acquisition Cost — prosečna cena akvizicije novog kupca (Potrošnja / Broj novih kupaca u periodu — kupac čija je prva ikad porudžbina u WooCommerce prodavnicama povezanim sa ovim oglasnim nalogom baš u ovom periodu).",
  },
];

function TopCampaignsTable({ rows, loading, currency }) {
  return (
    <div className="chart-card">
      <h3>Top kampanje</h3>
      <p className="chart-subtitle">Deset kampanja sa najvećom potrošnjom u periodu</p>
      {rows.length === 0 ? (
        <div className="empty-hint">{loading ? "Učitavanje…" : "Nema podataka."}</div>
      ) : (
        <div className="orders-items-table-wrap">
          <table className="orders-items-table">
            <thead>
              <tr>
                <th>Kampanja</th>
                <th>Potrošnja</th>
                <th>Klikovi</th>
                <th>Kupovine</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="gsc-key-cell">{row.campaign}</td>
                  <td>
                    {Math.round(row.spend).toLocaleString("sr-RS")} {currency}
                  </td>
                  <td>{row.clicks.toLocaleString("sr-RS")}</td>
                  <td>{row.purchases.toLocaleString("sr-RS")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const AD_TYPE_LABELS = {
  PHOTO: "Slika",
  VIDEO: "Video",
  SHARE: "Deljeni link",
  LINK: "Link",
  STATUS: "Status",
  CAROUSEL: "Karusel",
};

function formatDate(iso) {
  return iso ? iso.slice(0, 10) : "—";
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

function AllAdsTable({ rows, loading, currency }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const filteredRows =
    statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Land back on page 1 whenever the filter, page size, or underlying data
  // changes — otherwise a narrower filter can leave you stranded on a page
  // past the end.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize, rows]);

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>Sve kampanje</h3>
          <p className="chart-subtitle">Detaljan pregled svih objava u izabranom periodu</p>
        </div>
        {rows.length > 0 && (
          <div className="table-toolbar">
            <label className="per-page-select">
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Sve</option>
                <option value="active">Aktivne</option>
                <option value="inactive">Neaktivne</option>
              </select>
            </label>
            <label className="per-page-select">
              Po stranici
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty-hint">{loading ? "Učitavanje…" : "Nema podataka."}</div>
      ) : filteredRows.length === 0 ? (
        <div className="empty-hint">Nema objava za izabrani status.</div>
      ) : (
        <>
          <div className="orders-items-table-wrap">
            <table className="orders-items-table meta-ads-table">
              <thead>
                <tr>
                  <th>Ime objave</th>
                  <th>Status</th>
                  <th>Početak</th>
                  <th>Cena po danu</th>
                  <th>Broj dana</th>
                  <th>Ukupno</th>
                  <th>Tip objave</th>
                  <th>Reach</th>
                  <th>Impression</th>
                  <th>Clicks</th>
                  <th>Follows</th>
                  <th>Broj kupaca</th>
                  <th>Zarada</th>
                  <th>CTR</th>
                  <th>CPC</th>
                  <th>CPF</th>
                  <th>CPA</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={i}>
                    <td className="gsc-key-cell">{row.adName || "—"}</td>
                    <td>
                      <span
                        className={"status-pill" + (row.status === "active" ? "" : " inactive")}
                      >
                        {row.status === "active" ? "Aktivna" : "Neaktivna"}
                      </span>
                    </td>
                    <td>{formatDate(row.start)}</td>
                    <td>{formatKpiValue("currency", row.pricePerDay, currency)}</td>
                    <td>{row.days ?? "—"}</td>
                    <td>{formatKpiValue("currency", row.total, currency)}</td>
                    <td>{AD_TYPE_LABELS[row.adType] || row.adType || "—"}</td>
                    <td>{formatKpiValue("integer", row.reach)}</td>
                    <td>{formatKpiValue("integer", row.impressions)}</td>
                    <td>{formatKpiValue("integer", row.clicks)}</td>
                    <td>{formatKpiValue("integer", row.follows)}</td>
                    <td>{formatKpiValue("integer", row.purchases)}</td>
                    <td>{formatKpiValue("currency", row.revenue, row.revenueCurrency || currency)}</td>
                    <td>{formatKpiValue("percent", row.ctr)}</td>
                    <td>{formatKpiValue("currency", row.cpc, currency)}</td>
                    <td>{formatKpiValue("currency", row.cpf, currency)}</td>
                    <td>{formatKpiValue("currency", row.cpa, currency)}</td>
                    <td>{formatKpiValue("currency", row.profit, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function MetaAds() {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [range, setRange] = useState(YEAR_PRESET.range);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [from, to] = range;
  const currency = data?.currency || "RSD";

  useEffect(() => {
    fetchMetaStatus()
      .then((res) => {
        const list = res.connections || [];
        setConnections(list);
        setSelectedId(list[0]?.id || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchMetaPerformance(selectedId, from, to)
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
  }, [selectedId, from, to]);

  return (
    <div className="analytics-page">
      <div className="settings-header">
        <h1 className="settings-title">Meta Ads</h1>
        <p className="settings-subtitle">Potrošnja i performanse oglasa za povezane naloge.</p>
      </div>

      <div className="analytics-filters">
        {connections.length > 1 && (
          <label className="per-page-select">
            Nalog
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {(c.targetSiteUrls || []).map(siteLabel).join(", ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <DateRangePicker from={from} to={to} onChange={(f, t) => setRange([f, t])} />
      </div>

      {error ? (
        <div className="woo-error">{error}</div>
      ) : (
        <>
          <QuadrantCard
            title="Potrošnja i performanse"
            metrics={METRICS}
            values={data?.totals}
            loading={loading}
            currency={currency}
            wide
          />

          <MetaTrendChart series={data?.trend || []} currency={currency} />

          <TopCampaignsTable rows={data?.topCampaigns || []} loading={loading} currency={currency} />

          <AllAdsTable rows={data?.allAds || []} loading={loading} currency={currency} />
        </>
      )}
    </div>
  );
}
