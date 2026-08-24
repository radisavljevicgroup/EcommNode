import { useState } from "react";
import IconRail from "../components/IconRail";
import { HomeIcon, ChartIcon } from "../icons";
import AnalyticsOverview from "./analytics/AnalyticsOverview";
import SalesAnalysis from "./analytics/SalesAnalysis";

const ANALYTICS_RAIL_ITEMS = [
  { key: "pocetna", icon: HomeIcon, label: "Početna" },
  { key: "analiza-prodaje", icon: ChartIcon, label: "Analiza prodaje" },
];

export default function Analytics() {
  const [section, setSection] = useState("pocetna");

  return (
    <div className="settings-layout">
      <IconRail items={ANALYTICS_RAIL_ITEMS} active={section} onSelect={setSection} />

      <div className="settings-main">
        <div className="settings-wrap">
          {section === "analiza-prodaje" ? (
            <SalesAnalysis />
          ) : (
            <AnalyticsOverview onNavigate={setSection} />
          )}
        </div>
      </div>
    </div>
  );
}
