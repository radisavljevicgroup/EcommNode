import { useEffect, useState } from "react";
import IconRail from "../components/IconRail";
import { HomeIcon, ChartIcon, SearchIcon, TrendIcon } from "../icons";
import AnalyticsOverview from "./analytics/AnalyticsOverview";
import SalesAnalysis from "./analytics/SalesAnalysis";
import SearchConsole from "./analytics/SearchConsole";
import GoogleAnalytics from "./analytics/GoogleAnalytics";
import { fetchGscStatus } from "../api/gsc";
import { fetchGa4Status } from "../api/ga4";

const BASE_RAIL_ITEMS = [
  { key: "pocetna", icon: HomeIcon, label: "Početna" },
  { key: "analiza-prodaje", icon: ChartIcon, label: "Analiza prodaje" },
];

export default function Analytics() {
  const [section, setSection] = useState("pocetna");
  const [hasGsc, setHasGsc] = useState(false);
  const [hasGa4, setHasGa4] = useState(false);

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

  const railItems = [
    ...BASE_RAIL_ITEMS,
    ...(hasGa4 ? [{ key: "google-analytics", icon: TrendIcon, label: "Google Analytics 4" }] : []),
    ...(hasGsc ? [{ key: "search-console", icon: SearchIcon, label: "Search Console" }] : []),
  ];

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
          ) : (
            <AnalyticsOverview onNavigate={setSection} />
          )}
        </div>
      </div>
    </div>
  );
}
