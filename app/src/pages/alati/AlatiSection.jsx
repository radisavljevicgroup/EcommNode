import { useEffect, useState } from "react";
import { fetchSettings, updateSettings } from "../../api/settings";
import { TOOLS } from "./catalog";

// Premium tools (e.g. Napredna analiza prodaje) aren't part of this
// open-source checkout — each one lives in the private shopstack-premium
// repo and is only vendored locally into app/src/premium/<name>/
// analyticsTab.jsx (gitignored). If none are present, the glob matches
// nothing and no premium cards render.
const premiumAnalyticsModules = import.meta.glob("../../premium/*/analyticsTab.jsx", {
  eager: true,
});
const PREMIUM_TOOLS = Object.values(premiumAnalyticsModules)
  .filter((mod) => mod.toolCard)
  .map((mod) => mod.toolCard);

function ToolStatus({ enabled }) {
  return (
    <span className={"tool-status" + (enabled ? " on" : "")}>
      {enabled ? "Uključeno" : "Isključeno"}
    </span>
  );
}

export default function AlatiSection() {
  const [filter, setFilter] = useState("moje");
  const [staleEnabled, setStaleEnabled] = useState(true);
  const [staleThreshold, setStaleThreshold] = useState("");
  const [staleSaved, setStaleSaved] = useState(false);
  const [unfiscalizedEnabled, setUnfiscalizedEnabled] = useState(true);
  const [enabledPremiumTools, setEnabledPremiumTools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        setStaleEnabled(data.staleTrackingEnabled !== false);
        setStaleThreshold(String(data.staleOrderThresholdDays ?? 30));
        setUnfiscalizedEnabled(data.unfiscalizedTrackingEnabled !== false);
        setEnabledPremiumTools(data.enabledPremiumTools || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const enabledMap = { stale: staleEnabled, unfiscalized: unfiscalizedEnabled };

  const toggleStale = (enabled) => {
    setStaleEnabled(enabled);
    updateSettings({ staleTrackingEnabled: enabled }).catch(() => {});
  };

  const toggleUnfiscalized = (enabled) => {
    setUnfiscalizedEnabled(enabled);
    updateSettings({ unfiscalizedTrackingEnabled: enabled }).catch(() => {});
  };

  const togglePremiumTool = (key, enabled) => {
    const next = enabled
      ? [...enabledPremiumTools, key]
      : enabledPremiumTools.filter((k) => k !== key);
    setEnabledPremiumTools(next);
    updateSettings({ enabledPremiumTools: next }).catch(() => {});
  };

  const toggleHandlers = { stale: toggleStale, unfiscalized: toggleUnfiscalized };

  const saveStaleThreshold = () => {
    const n = Number(staleThreshold);
    if (!Number.isFinite(n) || n <= 0) return;
    updateSettings({ staleOrderThresholdDays: n })
      .then(() => {
        setStaleSaved(true);
        setTimeout(() => setStaleSaved(false), 2000);
      })
      .catch(() => {});
  };

  const myTools = TOOLS.filter((t) => enabledMap[t.key]);
  const myPremiumTools = PREMIUM_TOOLS.filter((t) => enabledPremiumTools.includes(t.key));

  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">Svi alati</h1>
        <p className="settings-subtitle">
          Automatski nadzor nad zakonskim rokovima u poslovanju — uključi ili isključi svaku
          alatku po potrebi.
        </p>
      </div>

      <div className="filter-tabs">
        <button
          type="button"
          className={"filter-tab" + (filter === "moje" ? " active" : "")}
          onClick={() => setFilter("moje")}
        >
          Moje alatke
        </button>
        <button
          type="button"
          className={"filter-tab" + (filter === "sve" ? " active" : "")}
          onClick={() => setFilter("sve")}
        >
          Sve alatke
        </button>
      </div>

      {filter === "moje" ? (
        myTools.length === 0 && myPremiumTools.length === 0 ? (
          <div className="empty-hint">Još uvek nemaš aktivnih alatki.</div>
        ) : (
          <>
            {myPremiumTools.map((t) => (
              <div className="integration-card" key={t.key}>
                <span className="tool-badge">
                  <t.icon />
                </span>
                <div className="integration-info">
                  <p className="integration-name">
                    {t.name}
                    <span className="status-pill premium">Premium</span>
                  </p>
                  <p className="integration-site">{t.shortDesc}</p>
                </div>
                <button
                  type="button"
                  className="tool-card-open-btn tool-card-open-btn-inline"
                  onClick={() => {
                    window.location.hash = "/analitika";
                  }}
                >
                  Otvori u Analitici
                </button>
                <button
                  className="integration-remove"
                  type="button"
                  onClick={() => togglePremiumTool(t.key, false)}
                >
                  Isključi
                </button>
              </div>
            ))}

            {myTools.map((t) => (
              <div className="integration-card" key={t.key}>
                <span className="tool-badge">
                  <t.icon />
                </span>
                <div className="integration-info">
                  <p className="integration-name">
                    {t.name}
                    <span className="status-pill">Uključeno</span>
                  </p>
                  <p className="integration-site">{t.shortDesc}</p>
                </div>
                <button
                  className="integration-remove"
                  type="button"
                  onClick={() => toggleHandlers[t.key](false)}
                >
                  Isključi
                </button>
              </div>
            ))}
          </>
        )
      ) : (
        <div className="integration-grid tool-grid">
          {PREMIUM_TOOLS.map((t) => {
            const enabled = enabledPremiumTools.includes(t.key);
            return (
              <div className="integration-grid-card" key={t.key}>
                <div className="tool-card-head">
                  <span className="tool-badge">
                    <t.icon />
                  </span>
                  <p className="integration-grid-name">
                    {t.name}
                    <span className="status-pill premium">Premium</span>
                  </p>
                </div>

                <p className="integration-grid-desc">{t.shortDesc}</p>

                <div className="tool-card-footer">
                  <div className="tool-card-toggle-row">
                    <ToolStatus enabled={enabled} />
                    <input
                      className="toggle"
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => togglePremiumTool(t.key, e.target.checked)}
                      disabled={loading}
                      aria-label={`Uključi/isključi: ${t.name}`}
                    />
                  </div>
                  {enabled && (
                    <button
                      type="button"
                      className="tool-card-open-btn"
                      onClick={() => {
                        window.location.hash = "/analitika";
                      }}
                    >
                      Otvori u Analitici
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {TOOLS.map((t) => (
            <div className="integration-grid-card" key={t.key}>
              <div className="tool-card-head">
                <span className="tool-badge">
                  <t.icon />
                </span>
                <p className="integration-grid-name">{t.name}</p>
              </div>

              <p className="integration-grid-desc">{t.desc}</p>

              <div className="tool-card-footer">
                <div className="tool-card-toggle-row">
                  <ToolStatus enabled={enabledMap[t.key]} />
                  <input
                    className="toggle"
                    type="checkbox"
                    checked={enabledMap[t.key]}
                    onChange={(e) => toggleHandlers[t.key](e.target.checked)}
                    disabled={loading}
                    aria-label={`Uključi/isključi: ${t.name}`}
                  />
                </div>
                {t.key === "stale" && (
                  <div className="stale-threshold-field">
                    <label className="settings-row-label" htmlFor="alati-stale-days">
                      Broj dana
                    </label>
                    <input
                      id="alati-stale-days"
                      className="settings-input"
                      type="number"
                      min="1"
                      value={staleThreshold}
                      onChange={(e) => setStaleThreshold(e.target.value)}
                      onBlur={saveStaleThreshold}
                      disabled={!staleEnabled || loading}
                    />
                    {staleSaved && <span className="stale-saved-hint">Sačuvano</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
