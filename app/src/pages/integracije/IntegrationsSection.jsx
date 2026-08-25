import { useEffect, useRef, useState } from "react";
import woocommerceLogo from "../../assets/woocommerce.png";
import WooCommerceIntegration from "../../components/WooCommerceIntegration";
import WooCommerceConnectModal from "../../components/WooCommerceConnectModal";
import Toast from "../../components/Toast";
import { fetchWooStatus } from "../../api/woocommerce";
import { INTEGRATION_CATALOG } from "./catalog";

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

  const handleWooConnected = (connection) => {
    setWooConnections((prev) => [...prev, connection]);
    setShowWooModal(false);
  };

  const handleWooDisconnected = (id) => {
    setWooConnections((prev) => prev.filter((c) => c.id !== id));
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

          {myIntegrations.length === 0 && wooConnections.length === 0 ? (
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

      <Toast type={toast?.type} message={toast?.message} />
    </>
  );
}
