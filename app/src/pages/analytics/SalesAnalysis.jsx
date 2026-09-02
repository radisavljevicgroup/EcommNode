import { useEffect, useRef, useState } from "react";
import { fetchWooStatus } from "../../api/woocommerce";
import { fetchShopifyStatus } from "../../api/shopify";
import {
  fetchAnalyticsSummary,
  fetchAnalyticsTrends,
  fetchTopProducts,
  fetchGeoDistribution,
  fetchSyncStatus,
  triggerSync,
} from "../../api/analytics";
import MultiSelect from "../../components/MultiSelect";
import DateRangePicker, { PRESETS } from "../../components/DateRangePicker";
import QuadrantCard from "../../components/QuadrantCard";
import MetricTrendModal from "../../components/MetricTrendModal";
import RevenueTrendChart from "../../components/charts/RevenueTrendChart";
import TopProductsChart from "../../components/charts/TopProductsChart";
import GeoDistributionChart from "../../components/charts/GeoDistributionChart";
import { KPI_QUADRANTS } from "../../constants/kpiDefinitions";
import { siteLabel } from "../../utils/site";
import { RefreshIcon } from "../../icons";

const YEAR_PRESET = PRESETS.find((p) => p.key === "year");

export default function SalesAnalysis() {
  const [connections, setConnections] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [range, setRange] = useState(YEAR_PRESET.range);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState([]);
  const [chartMetric, setChartMetric] = useState(null);
  const [productSortBy, setProductSortBy] = useState("revenue");
  const [refreshKey, setRefreshKey] = useState(0);

  const [from, to] = range;

  useEffect(() => {
    Promise.all([fetchWooStatus(), fetchShopifyStatus()])
      .then(([woo, shopify]) => {
        const list = [...(woo.connections || []), ...(shopify.connections || [])];
        setConnections(list);
        setSelectedIds(list.map((c) => c.id));
      })
      .catch(() => {});
  }, []);

  const idsKey = selectedIds.join(",");

  useEffect(() => {
    if (selectedIds.length === 0) {
      // No brands selected — show zeroed-out data instead of leaving
      // whatever was previously loaded on screen.
      setSummary({
        orderCount: 0,
        cr: null,
        aov: 0,
        upt: 0,
        shippingPercent: 0,
        rpr: 0,
        ltv: 0,
        tbo: 0,
        clv: 0,
        cac: null,
        cacCurrency: null,
        ofct: 0,
        returnRate: 0,
        currency: "RSD",
      });
      setTrends({ series: [], yoyPercent: null, currentTotal: 0, previousTotal: 0 });
      setTopProducts({ bestsellers: [], slowMovers: [], categories: [] });
      setGeo([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    const filters = { connectionIds: selectedIds, from, to };

    Promise.all([
      fetchAnalyticsSummary(filters),
      fetchAnalyticsTrends(filters),
      fetchTopProducts({ ...filters, sortBy: productSortBy }),
      fetchGeoDistribution(filters),
    ])
      .then(([s, t, p, g]) => {
        if (cancelled) return;
        setSummary(s);
        setTrends(t);
        setTopProducts(p);
        setGeo(g);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, from, to, productSortBy, refreshKey]);

  useEffect(() => {
    if (selectedIds.length === 0) return undefined;
    const filters = { connectionIds: selectedIds };
    const poll = () => {
      fetchSyncStatus(filters)
        .then((data) => setSyncStatus(data.connections))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const anySyncing = syncStatus.some((s) => s.syncing);

  // The sync banner promises the numbers below refresh automatically once
  // background sync finishes — without this, nothing actually re-fetches
  // them, so a sync that completes after the KPI data already loaded left
  // stale (often incomplete) numbers on screen indefinitely.
  const wasSyncing = useRef(false);
  useEffect(() => {
    if (wasSyncing.current && !anySyncing) {
      setRefreshKey((k) => k + 1);
    }
    wasSyncing.current = anySyncing;
  }, [anySyncing]);

  const handleManualSync = () => {
    triggerSync({ connectionIds: selectedIds });
  };

  const storeOptions = connections.map((c) => ({ id: c.id, label: siteLabel(c.siteUrl) }));

  return (
    <div className="analytics-page">
      <div className="settings-header">
        <h1 className="settings-title">Analiza prodaje</h1>
        <p className="settings-subtitle">
          Ključni pokazatelji poslovanja preko svih povezanih prodavnica.
        </p>
      </div>

      <div className="analytics-filters">
        <MultiSelect
          options={storeOptions}
          selected={selectedIds}
          onChange={setSelectedIds}
          placeholder="Izaberi brendove"
          showSelectAll
        />
        <DateRangePicker from={from} to={to} onChange={(f, t) => setRange([f, t])} />
        <button
          type="button"
          className="btn-save analytics-sync-btn"
          onClick={handleManualSync}
          disabled={anySyncing}
        >
          <RefreshIcon />
          {anySyncing ? "Sinhronizacija u toku…" : "Osveži podatke"}
        </button>
      </div>

      {anySyncing && (
        <div className="sync-banner">
          Podaci se sinhronizuju u pozadini (može potrajati par minuta na velikim
          prodavnicama) — brojevi ispod će se automatski ažurirati kad završi.
        </div>
      )}

      {connections.length === 0 ? (
        <div className="empty-hint">
          Poveži WooCommerce ili Shopify prodavnicu u Podešavanja → Integracije da bi video analitiku.
        </div>
      ) : error ? (
        <div className="woo-error">{error}</div>
      ) : (
        <>
          <div className="quadrant-grid">
            {KPI_QUADRANTS.map((q) => (
              <QuadrantCard
                key={q.key}
                title={q.title}
                metrics={q.metrics}
                values={summary}
                loading={loading}
                currency={summary?.currency || "RSD"}
                wide={q.wide}
                onMetricClick={setChartMetric}
              />
            ))}
          </div>

          {trends && (
            <RevenueTrendChart
              series={trends.series}
              yoyPercent={trends.yoyPercent}
              currency={summary?.currency || "RSD"}
            />
          )}
          {topProducts && (
            <TopProductsChart
              bestsellers={topProducts.bestsellers}
              categories={topProducts.categories}
              currency={summary?.currency || "RSD"}
              showSiteTag={selectedIds.length > 1}
              sortBy={productSortBy}
              onSortByChange={setProductSortBy}
            />
          )}
          {geo && <GeoDistributionChart data={geo} currency={summary?.currency || "RSD"} />}
        </>
      )}

      {chartMetric && (
        <MetricTrendModal
          metric={chartMetric}
          connectionIds={selectedIds}
          from={from}
          to={to}
          onClose={() => setChartMetric(null)}
        />
      )}
    </div>
  );
}
