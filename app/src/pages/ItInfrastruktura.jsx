import { useState } from "react";
import IconRail from "../components/IconRail";
import { HomeIcon } from "../icons";
import ItInfrastrukturaOverview from "./itInfrastruktura/ItInfrastrukturaOverview";
import { filterEntitledModules, useEnabledPremiumModules } from "../lib/premiumModules";

const BASE_RAIL_ITEMS = [{ key: "pregled", icon: HomeIcon, label: "Pregled" }];

// IT infrastructure integrations (e.g. Eurocom International — stock/price
// sync with a distributor) aren't part of this open-source checkout — each
// one lives in the private ecommnode-premium repo and is only vendored
// locally into app/src/premium/<name>/itInfraTab.jsx (gitignored). If none
// are present, the glob matches nothing and the rail only shows "Pregled".
// Which of the present ones render for this company is further gated by
// firme.enabled_premium_modules (see lib/premiumModules) — Eurocom's tab
// should only show up for the Eurocom account, not every company.
const premiumItInfraModules = import.meta.glob("../premium/*/itInfraTab.jsx", {
  eager: true,
});

export default function ItInfrastruktura() {
  const [section, setSection] = useState("pregled");
  const { enabledPremiumModules, loading } = useEnabledPremiumModules();

  const premiumTabs = filterEntitledModules(premiumItInfraModules, enabledPremiumModules).flatMap(
    ([, mod]) => mod.tabs || []
  );

  const railItems = [
    ...BASE_RAIL_ITEMS,
    ...premiumTabs.map(({ key, icon, label }) => ({ key, icon, label })),
  ];

  const activeTab = premiumTabs.find((t) => t.key === section);

  return (
    <div className="settings-layout">
      <IconRail items={railItems} active={section} onSelect={setSection} />

      <div className="settings-main">
        <div className="settings-wrap">
          {activeTab ? (
            <activeTab.Component />
          ) : (
            <ItInfrastrukturaOverview tabs={premiumTabs} loading={loading} onNavigate={setSection} />
          )}
        </div>
      </div>
    </div>
  );
}
