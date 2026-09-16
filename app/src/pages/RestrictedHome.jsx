import { useEffect, useState } from "react";
import { fetchWooStatus } from "../api/woocommerce";
import { fetchShopifyStatus } from "../api/shopify";
import { fetchDashboardSummaryForRange } from "../api/dashboard";
import { fetchAnalyticsTrends, fetchGeoDistribution } from "../api/analytics";
import { siteLabel } from "../utils/site";
import QuadrantCard from "../components/QuadrantCard";
import MultiSelect from "../components/MultiSelect";
import DateRangePicker, { PRESETS } from "../components/DateRangePicker";
import GeoDistributionChart from "../components/charts/GeoDistributionChart";
import RevenueOrdersTrendChart from "../components/charts/RevenueOrdersTrendChart";

const YEAR_PRESET = PRESETS.find((p) => p.key === "year");

const ORDER_METRICS = [
  {
    key: "orderCount",
    label: "Broj porudžbina",
    format: "integer",
    definition: "Broj realizovanih porudžbina (u obradi ili završenih) u izabranom periodu.",
    goodDirection: "up",
  },
  {
    key: "aov",
    label: "AOV",
    format: "currency",
    definition: "Average Order Value — prosečna vrednost korpe (Ukupan prihod / Broj porudžbina).",
    goodDirection: "up",
  },
  {
    key: "cancelledOrders",
    label: "Otkazane porudžbine",
    format: "integer",
    definition: "Broj porudžbina sa statusom „otkazano” u istom periodu.",
    goodDirection: "down",
  },
];

const LOGISTICS_METRICS = [
  {
    key: "shippedOrders",
    label: "Poslate",
    format: "integer",
    definition:
      "Porudžbine trenutno u statusu „u obradi” — najbliži dostupan status pošiljci na putu dok ne postoji poseban status za praćenje isporuke.",
    goodDirection: "up",
  },
  {
    key: "deliveredOrders",
    label: "Dostavljene",
    format: "integer",
    definition: "Porudžbine sa statusom „završeno”.",
    goodDirection: "up",
  },
  {
    key: "returnedOrders",
    label: "Vraćene",
    format: "integer",
    definition: "Otkazane i refundirane porudžbine u istom periodu.",
    goodDirection: "down",
  },
];

// Trimmed-down "Početna" for roles limited to just Porudžbine + Kalendar
// (see lib/roles.js RESTRICTED_HOME_ROLES) — the same building blocks as
// ManagerHome.jsx, but only the KPI cards and charts those roles should
// see: no revenue/ad-spend figures, no premium widgets, no GA4/GSC, no
// popular categories or worker performance.
//
// secondChart picks what replaces the year-over-year trend as the second
// chart: "geo" (Warehouse worker) shows where orders ship to instead, since
// last-year revenue comparison isn't their job but delivery destinations
// are; "yoy" (E-commerce Operations Manager) keeps the trend comparison.
export default function RestrictedHome({ secondChart = "yoy" }) {
  const [checkingStores, setCheckingStores] = useState(true);
  const [connections, setConnections] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [range, setRange] = useState(YEAR_PRESET.range);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(true);

  const [from, to] = range;

  useEffect(() => {
    Promise.all([fetchWooStatus(), fetchShopifyStatus()])
      .then(([woo, shopify]) => {
        const list = [...(woo.connections || []), ...(shopify.connections || [])];
        setConnections(list);
        setSelectedIds(list.map((c) => c.id));
      })
      .catch(() => {})
      .finally(() => setCheckingStores(false));
  }, []);

  const hasStores = connections.length > 0;
  const idsKey = selectedIds.join(",");

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSummary(null);
      setTrends(null);
      setGeo([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const filters = { connectionIds: selectedIds, from, to };

    Promise.all([
      fetchDashboardSummaryForRange(filters),
      fetchAnalyticsTrends(filters),
      secondChart === "geo" ? fetchGeoDistribution(filters) : Promise.resolve([]),
    ])
      .then(([s, t, g]) => {
        if (cancelled) return;
        setSummary(s);
        setTrends(t);
        setGeo(g);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, from, to, secondChart]);

  const quadrantValues = summary && {
    orderCount: summary.orders.current,
    aov: summary.aov.current,
    cancelledOrders: summary.cancelledOrders.current,
    shippedOrders: summary.shippedOrders.current,
    deliveredOrders: summary.deliveredOrders.current,
    returnedOrders: summary.returnedOrders.current,
    changePercent: {
      orderCount: summary.orders.changePercent,
      aov: summary.aov.changePercent,
      cancelledOrders: summary.cancelledOrders.changePercent,
      shippedOrders: summary.shippedOrders.changePercent,
      deliveredOrders: summary.deliveredOrders.changePercent,
      returnedOrders: summary.returnedOrders.changePercent,
    },
  };

  const storeOptions = connections.map((c) => ({ id: c.id, label: siteLabel(c.siteUrl) }));

  return (
    <div className="page-body home-page">
      <div className="settings-header">
        <h1 className="settings-title">Stanje poslovanja</h1>
        <p className="settings-subtitle">Izabrani period u odnosu na prethodni period jednake dužine.</p>
      </div>

      {checkingStores ? null : !hasStores ? (
        <div className="empty-hint">
          Poveži WooCommerce ili Shopify prodavnicu u Podešavanja → Integracije da bi video pregled poslovanja.
        </div>
      ) : (
        <>
          <div className="analytics-filters">
            <MultiSelect
              options={storeOptions}
              selected={selectedIds}
              onChange={setSelectedIds}
              placeholder="Izaberi brendove"
              showSelectAll
            />
            <DateRangePicker from={from} to={to} onChange={(f, t) => setRange([f, t])} />
          </div>

          <div className="quadrant-grid restricted-home-kpi-grid">
            <QuadrantCard
              title="Porudžbine i prosečna vrednost korpe"
              metrics={ORDER_METRICS}
              values={quadrantValues}
              loading={loading}
              currency={summary?.currency || "RSD"}
            />
            <QuadrantCard
              title="Poslate / dostavljene / vraćene"
              metrics={LOGISTICS_METRICS}
              values={quadrantValues}
              loading={loading}
            />
          </div>

          {trends && (
            <RevenueOrdersTrendChart
              series={trends.series}
              currency={summary?.currency || "RSD"}
              title="Grafikon prometa i porudžbina"
              subtitle="Promet i broj porudžbina po mesecu, za izabrani period."
              showPrevious={false}
            />
          )}

          {secondChart === "geo"
            ? geo && <GeoDistributionChart data={geo} currency={summary?.currency || "RSD"} />
            : trends && (
                <RevenueOrdersTrendChart
                  series={trends.series}
                  currency={summary?.currency || "RSD"}
                  title="Promet i porudžbine — ova vs. prošla godina"
                  subtitle="Isti kalendarski mesec upoređen sa godinu dana ranije."
                  showPrevious
                />
              )}
        </>
      )}
    </div>
  );
}
