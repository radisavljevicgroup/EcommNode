import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchWooStatus } from "../api/woocommerce";
import { fetchShopifyStatus } from "../api/shopify";
import { fetchDashboardSummaryForRange } from "../api/dashboard";
import { fetchAnalyticsTrends, fetchTopProducts, fetchGeoDistribution } from "../api/analytics";
import { fetchGa4Status, fetchGa4Performance } from "../api/ga4";
import { fetchGscStatus, fetchGscPerformance } from "../api/gsc";
import { fetchSettings } from "../api/settings";
import { siteLabel } from "../utils/site";
import QuadrantCard from "../components/QuadrantCard";
import MultiSelect from "../components/MultiSelect";
import DateRangePicker, { PRESETS } from "../components/DateRangePicker";
import GeoDistributionChart from "../components/charts/GeoDistributionChart";
import RevenueOrdersTrendChart from "../components/charts/RevenueOrdersTrendChart";
import { UsersIcon } from "../icons";
import { filterEntitledModules, useEnabledPremiumModules } from "../lib/premiumModules";

const YEAR_PRESET = PRESETS.find((p) => p.key === "year");

// Alarmi lives in the premium alerts module (ecommnode-premium), vendored
// the same way as every other premium tab — see ItInfrastruktura.jsx/
// AnalyticsOverview.jsx for the identical pattern. If that module isn't
// present in this checkout, the glob matches nothing and the section just
// doesn't render.
const premiumAnalyticsModules = import.meta.glob("../premium/*/analyticsTab.jsx", { eager: true });

// "Obaveštenja o zalihama" segments by which stock-related integration the
// company actually has — Eurocom's own auto-sync status and/or the
// stock-control tool's own auto-draft/auto-restore status, whichever
// exist. Each is a specific, known module (not a generic glob loop like
// the analyticsTab modules above) since the two widgets are bespoke per
// integration, not a uniform contract.
const eurocomHomeWidgets = import.meta.glob("../premium/eurocom/HomeSyncStatusCard.jsx", {
  eager: true,
});
const stockControlHomeWidgets = import.meta.glob(
  "../premium/stock-control/HomeCheckStatusCard.jsx",
  { eager: true }
);
const EurocomHomeSyncStatusCard = Object.values(eurocomHomeWidgets)[0]?.default;
const StockControlHomeCheckStatusCard = Object.values(stockControlHomeWidgets)[0]?.default;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

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

const REVENUE_METRICS = [
  {
    key: "revenue",
    label: "Ukupan prihod",
    format: "currency",
    definition: "Ukupan prihod od realizovanih porudžbina u izabranom periodu.",
    goodDirection: "up",
  },
];

const META_METRICS = [
  {
    key: "adSpend",
    label: "Potrošnja",
    format: "currency",
    definition: "Ukupno potrošeno na Meta oglase u izabranom periodu.",
    goodDirection: "down",
  },
  {
    key: "roas",
    label: "ROAS",
    format: "multiplier",
    definition: "Return On Ad Spend — prihod pripisan oglasima podeljen potrošnjom na njih.",
    goodDirection: "up",
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

export default function ManagerHome({ onNavigate }) {
  const [checkingStores, setCheckingStores] = useState(true);
  const [connections, setConnections] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [range, setRange] = useState(YEAR_PRESET.range);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [trends, setTrends] = useState(null);
  const [geo, setGeo] = useState(null);
  const [categories, setCategories] = useState(null);

  const [from, to] = range;

  const [ga4Connections, setGa4Connections] = useState([]);
  const [ga4Data, setGa4Data] = useState(null);
  const [ga4Loading, setGa4Loading] = useState(true);

  const [gscConnections, setGscConnections] = useState([]);
  const [gscData, setGscData] = useState(null);
  const [gscLoading, setGscLoading] = useState(true);

  const [enabledPremiumTools, setEnabledPremiumTools] = useState([]);
  const { enabledPremiumModules } = useEnabledPremiumModules();
  const entitledModules = filterEntitledModules(premiumAnalyticsModules, enabledPremiumModules).map(
    ([, mod]) => mod
  );
  const alertsModule = entitledModules.find((mod) => mod.overview?.key === "automatski-alarmi");
  const showAlerts = alertsModule && enabledPremiumTools.includes(alertsModule.toolCard.key);

  // Eurocom has no self-service on/off switch (see itInfraTab.jsx) — gated
  // purely by company entitlement, same as everywhere else it's checked.
  const showEurocomSync = EurocomHomeSyncStatusCard && enabledPremiumModules.includes("eurocom");
  // Stock-control isn't entitlement-restricted, just self-service toggled.
  const showStockControl =
    StockControlHomeCheckStatusCard && enabledPremiumTools.includes("kontrola-zaliha");

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

  useEffect(() => {
    fetchSettings()
      .then((data) => setEnabledPremiumTools(data.enabledPremiumTools || []))
      .catch(() => {});
  }, []);

  const hasStores = connections.length > 0;
  const idsKey = selectedIds.join(",");

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSummary(null);
      setTrends(null);
      setGeo([]);
      setCategories([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const filters = { connectionIds: selectedIds, from, to };

    Promise.all([
      fetchDashboardSummaryForRange(filters),
      fetchAnalyticsTrends(filters),
      fetchGeoDistribution(filters),
      fetchTopProducts({ ...filters, sortBy: "revenue" }),
    ])
      .then(([s, t, g, p]) => {
        if (cancelled) return;
        setSummary(s);
        setTrends(t);
        setGeo(g);
        setCategories(p.categories || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, from, to]);

  useEffect(() => {
    fetchGa4Status()
      .then((data) => {
        const list = data.connections || [];
        setGa4Connections(list);
        if (list.length === 0) return null;
        const to = isoDate(new Date());
        const from = isoDate(new Date(new Date().setMonth(new Date().getMonth() - 3)));
        return fetchGa4Performance(list[0].id, from, to).then(setGa4Data);
      })
      .catch(() => {})
      .finally(() => setGa4Loading(false));
  }, []);

  useEffect(() => {
    fetchGscStatus()
      .then((data) => {
        const list = data.connections || [];
        setGscConnections(list);
        if (list.length === 0) return null;
        const to = isoDate(new Date());
        const from = isoDate(new Date(new Date().setMonth(new Date().getMonth() - 3)));
        return fetchGscPerformance(list[0].id, from, to).then(setGscData);
      })
      .catch(() => {})
      .finally(() => setGscLoading(false));
  }, []);

  const quadrantValues = summary && {
    orderCount: summary.orders.current,
    aov: summary.aov.current,
    cancelledOrders: summary.cancelledOrders.current,
    revenue: summary.revenue.current,
    adSpend: summary.adSpend.current,
    adSpendCurrency: summary.metaCurrency || summary.currency,
    roas: summary.roas.current,
    shippedOrders: summary.shippedOrders.current,
    deliveredOrders: summary.deliveredOrders.current,
    returnedOrders: summary.returnedOrders.current,
    changePercent: {
      orderCount: summary.orders.changePercent,
      aov: summary.aov.changePercent,
      cancelledOrders: summary.cancelledOrders.changePercent,
      revenue: summary.revenue.changePercent,
      adSpend: summary.adSpend.changePercent,
      roas: summary.roas.changePercent,
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

          <div className="quadrant-grid manager-home-kpi-grid">
            <QuadrantCard
              title="Porudžbine i prosečna vrednost korpe"
              metrics={ORDER_METRICS}
              values={quadrantValues}
              loading={loading}
              currency={summary?.currency || "RSD"}
            />
            <QuadrantCard
              title="Ukupan prihod"
              metrics={REVENUE_METRICS}
              values={quadrantValues}
              loading={loading}
              currency={summary?.currency || "RSD"}
            />
            <QuadrantCard
              title="Trošak oglašavanja (Meta)"
              metrics={META_METRICS}
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

          {trends && (
            <RevenueOrdersTrendChart
              series={trends.series}
              currency={summary?.currency || "RSD"}
              title="Promet i porudžbine — ova vs. prošla godina"
              subtitle="Isti kalendarski mesec upoređen sa godinu dana ranije."
              showPrevious
            />
          )}

          {showAlerts && (
            <div className="chart-card">
              <div className="chart-card-head">
                <h3>Alarmi</h3>
                <button
                  type="button"
                  className="performance-link"
                  onClick={() => onNavigate?.("analitika")}
                >
                  Kompletan izveštaj →
                </button>
              </div>
              <p className="chart-subtitle">
                Obaveštenja pri naglom padu konverzije, anomalijama u prodaji ili padu zaliha ispod
                kritičnog nivoa.
              </p>
              <alertsModule.overview.Component />
            </div>
          )}

          {geo && <GeoDistributionChart data={geo} currency={summary?.currency || "RSD"} />}

          {showEurocomSync && <EurocomHomeSyncStatusCard />}
          {showStockControl && <StockControlHomeCheckStatusCard />}

          {(ga4Connections.length > 0 || gscConnections.length > 0) && (
            <div className="manager-home-dual-row">
              {ga4Connections.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-head">
                    <h3>Google Analytics</h3>
                    <button
                      type="button"
                      className="performance-link"
                      onClick={() => onNavigate?.("analitika")}
                    >
                      Kompletan izveštaj →
                    </button>
                  </div>
                  <p className="chart-subtitle">Sesije i aktivni korisnici, poslednja 3 meseca.</p>
                  {!ga4Loading && ga4Data?.trend?.length === 0 ? (
                    <div className="empty-hint">Nema podataka za poslednja 3 meseca.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={ga4Data?.trend || []}>
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} width={60} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="sessions" name="Sesije" stroke="#480ca8" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="activeUsers" name="Aktivni korisnici" stroke="#9d8189" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {gscConnections.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-head">
                    <h3>Google Search Console</h3>
                    <button
                      type="button"
                      className="performance-link"
                      onClick={() => onNavigate?.("analitika")}
                    >
                      Kompletan izveštaj →
                    </button>
                  </div>
                  <p className="chart-subtitle">Klikovi i prikazi iz Google pretrage, poslednja 3 meseca.</p>
                  {!gscLoading && gscData?.trend?.length === 0 ? (
                    <div className="empty-hint">Nema podataka za poslednja 3 meseca.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={gscData?.trend || []}>
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} width={60} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} width={60} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="clicks" name="Klikovi" stroke="#480ca8" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="impressions" name="Prikazi" stroke="#9d8189" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="chart-card">
            <h3>Popularne kategorije</h3>
            <p className="chart-subtitle">Deset kategorija sa najvećim prihodom za izabrani period.</p>
            {!categories || categories.length === 0 ? (
              <div className="empty-hint">Nema podataka.</div>
            ) : (
              <div className="top-categories-grid">
                {categories.map((c) => (
                  <div className="top-category-card" key={`${c.site || ""}::${c.name}`}>
                    {c.image ? (
                      <img className="top-category-img" src={c.image} alt={c.name} />
                    ) : (
                      <div className="top-category-img placeholder">{c.name[0]}</div>
                    )}
                    <p className="top-category-name">{c.name}</p>
                    {connections.length > 1 && c.site && (
                      <span className="order-source-tag top-category-site">{siteLabel(c.site)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="chart-card">
            <div className="chart-card-head">
              <h3>Učinak radnika</h3>
              <UsersIcon />
            </div>
            <p className="chart-subtitle">
              Praćenje broja obrađenih porudžbina i poziva po radniku je u pripremi — trenutno se ne
              beleži koji radnik je obradio koju porudžbinu.
            </p>
            <div className="empty-hint">Uskoro dostupno.</div>
          </div>
        </>
      )}
    </div>
  );
}
