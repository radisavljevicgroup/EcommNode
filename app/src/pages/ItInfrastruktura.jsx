import { useEffect, useState } from "react";
import IconRail from "../components/IconRail";
import { HomeIcon } from "../icons";
import ItInfrastrukturaOverview from "./itInfrastruktura/ItInfrastrukturaOverview";
import { filterEntitledModules, useEnabledPremiumModules } from "../lib/premiumModules";
import { fetchSettings } from "../api/settings";

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
  const [enabledPremiumTools, setEnabledPremiumTools] = useState([]);
  const { enabledPremiumModules, loading } = useEnabledPremiumModules();

  useEffect(() => {
    fetchSettings()
      .then((data) => setEnabledPremiumTools(data.enabledPremiumTools || []))
      .catch(() => {});
  }, []);

  // A module with no toolCard (e.g. Eurocom) has no on/off switch in
  // "Alati" at all — it stays gated purely by entitlement, same as
  // before this filter existed. A module that DOES export a toolCard
  // (self-service premium tools, see AlatiSection.jsx) only shows its
  // IT-infra tab once the company has actually turned it on there —
  // otherwise every entitled company would see the tab appear on its
  // own, without ever having "activated" it. Mirrors the identical
  // check in Analytics.jsx for the analogous Analitika-page tabs.
  const premiumTabs = filterEntitledModules(premiumItInfraModules, enabledPremiumModules)
    .map(([, mod]) => mod)
    .filter((mod) => !mod.toolCard?.key || enabledPremiumTools.includes(mod.toolCard.key))
    .flatMap((mod) => mod.tabs || []);

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
