import { useEffect, useRef, useState } from "react";
import woocommerceLogo from "../../assets/woocommerce.png";
import googleAnalyticsLogo from "../../assets/google-analytics.png";
import googleSearchConsoleLogo from "../../assets/google-search-console.jpg";
import WooCommerceIntegration from "../../components/WooCommerceIntegration";
import WooCommerceConnectModal from "../../components/WooCommerceConnectModal";
import Ga4Integration from "../../components/Ga4Integration";
import Ga4ConnectModal from "../../components/Ga4ConnectModal";
import GscIntegration from "../../components/GscIntegration";
import GscConnectModal from "../../components/GscConnectModal";
import Toast from "../../components/Toast";
import { fetchWooStatus } from "../../api/woocommerce";
import { fetchGa4Status } from "../../api/ga4";
import { fetchGscStatus } from "../../api/gsc";
import { INTEGRATION_CATALOG } from "./catalog";

// Premium integrations (e.g. Eurocom International) aren't part of this
// open-source checkout — their source lives in the private
// shopstack-premium repo and is only vendored locally into
// app/src/premium/<name>/index.jsx (gitignored). If that folder is absent,
// the glob simply matches nothing and no premium cards render.
const premiumModules = import.meta.glob("../../premium/*/index.jsx", { eager: true });
const PREMIUM_INTEGRATIONS = Object.entries(premiumModules).map(([key, mod]) => ({
  key,
  Component: mod.default,
}));

function IntegrationBadge({ platform }) {
  if (platform.custom) return null;
  return (
    <span className="integration-badge">
      <img src={platform.logo} alt={platform.name} />
    </span>
  );
}

export default function IntegrationsSection() {
  const [filter, setFilter] = useState("moje");
  const [connectedKeys, setConnectedKeys] = useState([]);

  const [wooConnections, setWooConnections] = useState([]);
  const [wooChecking, setWooChecking] = useState(true);
  const [showWooModal, setShowWooModal] = useState(false);
  const [premiumCounts, setPremiumCounts] = useState({});
  const [ga4Connections, setGa4Connections] = useState([]);
  const [ga4Checking, setGa4Checking] = useState(true);
  const [showGa4Modal, setShowGa4Modal] = useState(false);
  const [gscConnections, setGscConnections] = useState([]);
  const [gscChecking, setGscChecking] = useState(true);
  const [showGscModal, setShowGscModal] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchWooStatus()
      .then((data) => setWooConnections(data.connections || []))
      .catch(() => {})
      .finally(() => setWooChecking(false));
  }, []);

  useEffect(() => {
    fetchGa4Status()
      .then((data) => setGa4Connections(data.connections || []))
      .catch(() => {})
      .finally(() => setGa4Checking(false));
  }, []);

  useEffect(() => {
    fetchGscStatus()
      .then((data) => setGscConnections(data.connections || []))
      .catch(() => {})
      .finally(() => setGscChecking(false));
  }, []);

  const handleWooConnected = (connection) => {
    setWooConnections((prev) => [...prev, connection]);
    setShowWooModal(false);
  };

  const handleWooDisconnected = (id) => {
    setWooConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const handleGa4Connected = (connection) => {
    setGa4Connections((prev) => [...prev, connection]);
    setShowGa4Modal(false);
  };

  const handleGa4Disconnected = (id) => {
    setGa4Connections((prev) => prev.filter((c) => c.id !== id));
  };

  const handleGscConnected = (connection) => {
    setGscConnections((prev) => [...prev, connection]);
    setShowGscModal(false);
  };

  const handleGscDisconnected = (id) => {
    setGscConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const connect = (key) => {
    setConnectedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    const platform = INTEGRATION_CATALOG.find((p) => p.key === key);
    showToast("success", `Uspešno povezano: ${platform?.name || key}`);
  };

  const disconnect = (key) => {
    setConnectedKeys((prev) => prev.filter((k) => k !== key));
    const platform = INTEGRATION_CATALOG.find((p) => p.key === key);
    showToast("success", `Integracija uklonjena: ${platform?.name || key}`);
  };

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
        <>
          {wooConnections.map((connection) => (
            <WooCommerceIntegration
              key={connection.id}
              connection={connection}
              onDisconnected={handleWooDisconnected}
              onResult={showToast}
            />
          ))}

          {PREMIUM_INTEGRATIONS.map(({ key, Component }) => (
            <Component
              key={key}
              view="moje"
              wooConnections={wooConnections}
              onResult={showToast}
              onCountChange={(n) => setPremiumCounts((prev) => ({ ...prev, [key]: n }))}
            />
          ))}

          {ga4Connections.map((connection) => (
            <Ga4Integration
              key={connection.id}
              connection={connection}
              onDisconnected={handleGa4Disconnected}
              onResult={showToast}
            />
          ))}

          {gscConnections.map((connection) => (
            <GscIntegration
              key={connection.id}
              connection={connection}
              onDisconnected={handleGscDisconnected}
              onResult={showToast}
            />
          ))}

          {myIntegrations.length === 0 &&
          wooConnections.length === 0 &&
          Object.values(premiumCounts).every((n) => !n) &&
          ga4Connections.length === 0 &&
          gscConnections.length === 0 ? (
            <div className="empty-hint">Još uvek nemaš povezanih integracija.</div>
          ) : (
            myIntegrations.map((p) => (
              <div className="integration-card" key={p.key}>
                <IntegrationBadge platform={p} />
                <div className="integration-info">
                  <p className="integration-name">
                    {p.name}
                    <span className="status-pill">Povezano</span>
                  </p>
                  <p className="integration-site">Povezano preko API-ja</p>
                </div>
                <button
                  className="integration-remove"
                  type="button"
                  onClick={() => disconnect(p.key)}
                >
                  Ukloni
                </button>
              </div>
            ))
          )}
        </>
      ) : (
        <div className="integration-grid">
          <div className="integration-grid-card">
            <span className="integration-badge">
              <img src={woocommerceLogo} alt="WooCommerce" />
            </span>
            <p className="integration-grid-name">
              WooCommerce
              {wooConnections.length > 0 && (
                <span className="status-pill">{wooConnections.length}</span>
              )}
            </p>
            <p className="integration-grid-desc">
              Poveži svoju WooCommerce prodavnicu
            </p>
            <button
              type="button"
              className="integration-grid-action"
              disabled={wooChecking}
              onClick={() => setShowWooModal(true)}
            >
              {wooConnections.length > 0 ? "+ Poveži još jednu" : "Poveži"}
            </button>
          </div>

          {PREMIUM_INTEGRATIONS.map(({ key, Component }) => (
            <Component
              key={key}
              view="sve"
              wooConnections={wooConnections}
              onResult={showToast}
              onCountChange={(n) => setPremiumCounts((prev) => ({ ...prev, [key]: n }))}
            />
          ))}

          <div className="integration-grid-card">
            <span className="integration-badge">
              <img src={googleAnalyticsLogo} alt="Google Analytics 4" />
            </span>
            <p className="integration-grid-name">
              Google Analytics 4
              {ga4Connections.length > 0 && (
                <span className="status-pill">{ga4Connections.length}</span>
              )}
            </p>
            <p className="integration-grid-desc">Prati saobraćaj i konverzije na sajtu</p>
            <button
              type="button"
              className="integration-grid-action"
              disabled={ga4Checking || wooConnections.length === 0}
              onClick={() => setShowGa4Modal(true)}
            >
              {ga4Connections.length > 0 ? "+ Poveži još jednu" : "Poveži"}
            </button>
            {wooConnections.length === 0 && (
              <p className="woo-field-hint">Prvo poveži WooCommerce prodavnicu.</p>
            )}
          </div>

          <div className="integration-grid-card">
            <span className="integration-badge">
              <img src={googleSearchConsoleLogo} alt="Google Search Console" />
            </span>
            <p className="integration-grid-name">
              Google Search Console
              {gscConnections.length > 0 && (
                <span className="status-pill">{gscConnections.length}</span>
              )}
            </p>
            <p className="integration-grid-desc">Prati performanse u Google pretrazi</p>
            <button
              type="button"
              className="integration-grid-action"
              disabled={gscChecking || wooConnections.length === 0}
              onClick={() => setShowGscModal(true)}
            >
              {gscConnections.length > 0 ? "+ Poveži još jednu" : "Poveži"}
            </button>
            {wooConnections.length === 0 && (
              <p className="woo-field-hint">Prvo poveži WooCommerce prodavnicu.</p>
            )}
          </div>

          {INTEGRATION_CATALOG.map((p) => {
            const isConnected = connectedKeys.includes(p.key);
            return (
              <div
                className={"integration-grid-card" + (p.custom ? " custom" : "")}
                key={p.key}
              >
                <IntegrationBadge platform={p} />
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

      {showWooModal && (
        <WooCommerceConnectModal
          onClose={() => setShowWooModal(false)}
          onConnected={handleWooConnected}
          onResult={showToast}
        />
      )}

      {showGa4Modal && (
        <Ga4ConnectModal
          wooConnections={wooConnections}
          onClose={() => setShowGa4Modal(false)}
          onConnected={handleGa4Connected}
          onResult={showToast}
        />
      )}

      {showGscModal && (
        <GscConnectModal
          wooConnections={wooConnections}
          onClose={() => setShowGscModal(false)}
          onConnected={handleGscConnected}
          onResult={showToast}
        />
      )}

      <Toast type={toast?.type} message={toast?.message} />
    </>
  );
}
