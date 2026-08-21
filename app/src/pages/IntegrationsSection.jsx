import { useState } from "react";

export const INTEGRATION_CATALOG = [
  {
    key: "woocommerce",
    name: "WooCommerce",
    color: "#7f54b3",
    badge: "W",
    desc: "Poveži svoju WooCommerce prodavnicu",
  },
  {
    key: "shopify",
    name: "Shopify",
    color: "#95bf47",
    badge: "S",
    desc: "Poveži svoju Shopify prodavnicu",
  },
  {
    key: "ga4",
    name: "Google Analytics 4",
    color: "#f9ab00",
    badge: "GA4",
    desc: "Prati saobraćaj i konverzije na sajtu",
  },
  {
    key: "gsc",
    name: "Google Search Console",
    color: "#4285f4",
    badge: "GSC",
    desc: "Prati performanse u Google pretrazi",
  },
  {
    key: "meta",
    name: "Meta",
    color: "#0866ff",
    badge: "M",
    desc: "Facebook i Instagram oglašavanje",
  },
  {
    key: "custom",
    name: "<CUSTOM SOLUTION/>",
    custom: true,
    desc: "Poveži sopstveno rešenje preko API-ja",
  },
];

export const DEMO_DETAILS = {
  woocommerce: {
    site: "prodavnica.rs",
    apiKey: "wc_live_••••••••92ac",
    connectedAt: "12.03.2026.",
  },
};

export default function IntegrationsSection() {
  const [filter, setFilter] = useState("moje");
  const [connectedKeys, setConnectedKeys] = useState(["woocommerce"]);

  const connect = (key) =>
    setConnectedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));

  const disconnect = (key) =>
    setConnectedKeys((prev) => prev.filter((k) => k !== key));

  const myIntegrations = INTEGRATION_CATALOG.filter((p) =>
    connectedKeys.includes(p.key)
  );

  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">Integracije</h1>
        <p className="settings-subtitle">
          Poveži Shopstack sa svojim online prodavnicama.
        </p>
      </div>

      <div className="filter-tabs">
        <button
          type="button"
          className={"filter-tab" + (filter === "moje" ? " active" : "")}
          onClick={() => setFilter("moje")}
        >
          Moje integracije
        </button>
        <button
          type="button"
          className={"filter-tab" + (filter === "sve" ? " active" : "")}
          onClick={() => setFilter("sve")}
        >
          Sve integracije
        </button>
      </div>

      {filter === "moje" ? (
        myIntegrations.length === 0 ? (
          <div className="empty-hint">Još uvek nemaš povezanih integracija.</div>
        ) : (
          myIntegrations.map((p) => {
            const details = DEMO_DETAILS[p.key];
            return (
              <div className="integration-card" key={p.key}>
                <span className="integration-badge" style={{ background: p.color }}>
                  {p.badge}
                </span>
                <div className="integration-info">
                  <p className="integration-name">
                    {p.name}
                    <span className="status-pill">Povezano</span>
                  </p>
                  {details ? (
                    <>
                      <p className="integration-site">{details.site}</p>
                      <p className="integration-meta">
                        API ključ: {details.apiKey} · povezano{" "}
                        {details.connectedAt}
                      </p>
                    </>
                  ) : (
                    <p className="integration-site">Povezano preko API-ja</p>
                  )}
                </div>
                <button
                  className="integration-remove"
                  type="button"
                  onClick={() => disconnect(p.key)}
                >
                  Ukloni
                </button>
              </div>
            );
          })
        )
      ) : (
        <div className="integration-grid">
          {INTEGRATION_CATALOG.map((p) => {
            const isConnected = connectedKeys.includes(p.key);
            return (
              <div
                className={"integration-grid-card" + (p.custom ? " custom" : "")}
                key={p.key}
              >
                {!p.custom && (
                  <span
                    className="integration-badge"
                    style={{ background: p.color }}
                  >
                    {p.badge}
                  </span>
                )}
                <p className="integration-grid-name">{p.name}</p>
                <p className="integration-grid-desc">{p.desc}</p>
                <button
                  type="button"
                  className={
                    "integration-grid-action" + (isConnected ? " connected" : "")
                  }
                  disabled={isConnected}
                  onClick={() => connect(p.key)}
                >
                  {isConnected ? "Povezano" : "Poveži"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
