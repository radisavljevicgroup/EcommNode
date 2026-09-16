import { useEffect, useState } from "react";
import { fetchWooStatus } from "../api/woocommerce";
import { fetchShopifyStatus } from "../api/shopify";
import { fetchDashboardSummaryForRange } from "../api/dashboard";
import { fetchSettings } from "../api/settings";
import { siteLabel } from "../utils/site";
import QuadrantCard from "../components/QuadrantCard";
import MultiSelect from "../components/MultiSelect";
import DateRangePicker, { PRESETS } from "../components/DateRangePicker";
import { filterEntitledModules, useEnabledPremiumModules } from "../lib/premiumModules";

const YEAR_PRESET = PRESETS.find((p) => p.key === "year");

// Same premium home-widget glob pattern as ManagerHome.jsx — see that
// file's comment. IT Administrator only gets the two IT-facing status
// cards, not the business-performance widgets ManagerHome shows.
const eurocomHomeWidgets = import.meta.glob("../premium/eurocom/HomeSyncStatusCard.jsx", {
  eager: true,
});
const stockControlHomeWidgets = import.meta.glob(
  "../premium/stock-control/HomeCheckStatusCard.jsx",
  { eager: true }
);
const EurocomHomeSyncStatusCard = Object.values(eurocomHomeWidgets)[0]?.default;
const StockControlHomeCheckStatusCard = Object.values(stockControlHomeWidgets)[0]?.default;

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

// Trimmed-down "Početna" for IT Administrator (see lib/roles.js
// RESTRICTED_HOME_ROLES) — the order KPI card for general context, plus
// the two IT-facing integration status widgets ManagerHome.jsx also shows.
// No revenue/ad-spend, no trend charts, no premium analytics tools — this
// role's nav is limited to IT Infrastruktura, and this home reflects that.
export default function ItAdminHome() {
  const [checkingStores, setCheckingStores] = useState(true);
  const [connections, setConnections] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [range, setRange] = useState(YEAR_PRESET.range);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enabledPremiumTools, setEnabledPremiumTools] = useState([]);
  const { enabledPremiumModules } = useEnabledPremiumModules();

  const [from, to] = range;

  // Eurocom has no self-service on/off switch — gated purely by company
  // entitlement, same as everywhere else it's checked. Stock-control isn't
  // entitlement-restricted, just self-service toggled in Alati.
  const showEurocomSync = EurocomHomeSyncStatusCard && enabledPremiumModules.includes("eurocom");
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
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchDashboardSummaryForRange({ connectionIds: selectedIds, from, to })
      .then((s) => {
        if (!cancelled) setSummary(s);
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

  const quadrantValues = summary && {
    orderCount: summary.orders.current,
    aov: summary.aov.current,
    cancelledOrders: summary.cancelledOrders.current,
    changePercent: {
      orderCount: summary.orders.changePercent,
      aov: summary.aov.changePercent,
      cancelledOrders: summary.cancelledOrders.changePercent,
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

          <div className="quadrant-grid">
            <QuadrantCard
              title="Porudžbine i prosečna vrednost korpe"
              metrics={ORDER_METRICS}
              values={quadrantValues}
              loading={loading}
              currency={summary?.currency || "RSD"}
            />
          </div>

          {showEurocomSync && <EurocomHomeSyncStatusCard />}
          {showStockControl && <StockControlHomeCheckStatusCard />}
        </>
      )}
    </div>
  );
}
