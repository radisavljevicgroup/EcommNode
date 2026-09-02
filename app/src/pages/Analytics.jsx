import { useEffect, useState } from "react";
import IconRail from "../components/IconRail";
import { HomeIcon, ChartIcon, SearchIcon, TrendIcon, MetaIcon } from "../icons";
import AnalyticsOverview from "./analytics/AnalyticsOverview";
import SalesAnalysis from "./analytics/SalesAnalysis";
import SearchConsole from "./analytics/SearchConsole";
import GoogleAnalytics from "./analytics/GoogleAnalytics";
import MetaAds from "./analytics/MetaAds";
import { fetchGscStatus } from "../api/gsc";
import { fetchGa4Status } from "../api/ga4";
import { fetchMetaStatus } from "../api/meta";
import { fetchSettings } from "../api/settings";

const BASE_RAIL_ITEMS = [
  { key: "pocetna", icon: HomeIcon, label: "Početna" },
  { key: "analiza-prodaje", icon: ChartIcon, label: "Analiza prodaje" },
];

// Premium analytics tools (e.g. Napredna analiza prodaje) aren't part of
// this open-source checkout — each one lives in the private
// ecommnode-premium repo and is only vendored locally into
// app/src/premium/<name>/analyticsTab.jsx (gitignored). If none are
// present, the glob matches nothing and no premium tabs render.
const premiumAnalyticsModules = import.meta.glob("../premium/*/analyticsTab.jsx", {
  eager: true,
});
const PREMIUM_MODULES = Object.values(premiumAnalyticsModules);

export default function Analytics() {
  const [section, setSection] = useState("pocetna");
  const [hasGsc, setHasGsc] = useState(false);
  const [hasGa4, setHasGa4] = useState(false);
  const [hasMeta, setHasMeta] = useState(false);
  const [enabledPremiumTools, setEnabledPremiumTools] = useState([]);

  useEffect(() => {
    fetchGscStatus()
      .then((data) => setHasGsc((data.connections || []).length > 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchGa4Status()
      .then((data) => setHasGa4((data.connections || []).length > 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMetaStatus()
      .then((data) => setHasMeta((data.connections || []).length > 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSettings()
      .then((data) => setEnabledPremiumTools(data.enabledPremiumTools || []))
      .catch(() => {});
  }, []);

  const enabledPremiumModules = PREMIUM_MODULES.filter(
    (mod) => !mod.toolCard?.key || enabledPremiumTools.includes(mod.toolCard.key)
  ).filter((mod) => mod.tabs?.length);

  const PREMIUM_TABS = enabledPremiumModules.flatMap((mod) => mod.tabs);

  // A module with multiple tabs (e.g. Napredna analiza prodaje: ABC,
  // cross-sell, obrt zaliha) collapses into one rail icon with those tabs
  // as a hover submenu, instead of cluttering the rail with one icon each.
  const premiumRailItems = enabledPremiumModules.map((mod) =>
    mod.tabs.length > 1
      ? {
          key: mod.tabs[0].key,
          icon: mod.toolCard?.icon || mod.tabs[0].icon,
          label: mod.toolCard?.name || mod.tabs[0].label,
          children: mod.tabs,
        }
      : { key: mod.tabs[0].key, icon: mod.tabs[0].icon, label: mod.tabs[0].label }
  );

  const railItems = [
    ...BASE_RAIL_ITEMS,
    ...(hasGa4 ? [{ key: "google-analytics", icon: TrendIcon, label: "Google Analytics 4" }] : []),
    ...(hasGsc ? [{ key: "search-console", icon: SearchIcon, label: "Search Console" }] : []),
    ...(hasMeta ? [{ key: "meta-ads", icon: MetaIcon, label: "Meta Ads" }] : []),
    ...premiumRailItems,
  ];

  const activePremiumTab = PREMIUM_TABS.find((t) => t.key === section);

  return (
    <div className="settings-layout">
      <IconRail items={railItems} active={section} onSelect={setSection} />

      <div className="settings-main">
        <div className="settings-wrap">
          {section === "analiza-prodaje" ? (
            <SalesAnalysis />
          ) : section === "google-analytics" && hasGa4 ? (
            <GoogleAnalytics />
          ) : section === "search-console" && hasGsc ? (
            <SearchConsole />
          ) : section === "meta-ads" && hasMeta ? (
            <MetaAds />
          ) : activePremiumTab ? (
            <activePremiumTab.Component />
          ) : (
            <AnalyticsOverview onNavigate={setSection} />
          )}
        </div>
      </div>
    </div>
  );
}
