import { useEffect, useRef, useState } from "react";
import woocommerceLogo from "../../assets/woocommerce.png";
import shopifyLogo from "../../assets/shopify.png";
import googleAnalyticsLogo from "../../assets/google-analytics.png";
import googleSearchConsoleLogo from "../../assets/google-search-console.jpg";
import metaLogo from "../../assets/meta.jpg";
import WooCommerceIntegration from "../../components/WooCommerceIntegration";
import WooCommerceConnectModal from "../../components/WooCommerceConnectModal";
import ShopifyIntegration from "../../components/ShopifyIntegration";
import ShopifyConnectModal from "../../components/ShopifyConnectModal";
import Ga4Integration from "../../components/Ga4Integration";
import Ga4ConnectModal from "../../components/Ga4ConnectModal";
import GscIntegration from "../../components/GscIntegration";
import GscConnectModal from "../../components/GscConnectModal";
import MetaIntegration from "../../components/MetaIntegration";
import MetaConnectModal from "../../components/MetaConnectModal";
import InboxChannelIntegration from "../../components/InboxChannelIntegration";
import InboxChannelConnectModal from "../../components/InboxChannelConnectModal";
import PlatformBadge from "../../components/PlatformBadge";
import Toast from "../../components/Toast";
import { fetchWooStatus } from "../../api/woocommerce";
import { fetchShopifyStatus } from "../../api/shopify";
import { fetchGa4Status } from "../../api/ga4";
import { fetchGscStatus } from "../../api/gsc";
import { fetchMetaStatus } from "../../api/meta";
import { fetchInboxConnections } from "../../api/inboxConnections";
import { INTEGRATION_CATALOG } from "./catalog";
import { filterEntitledModules, useEnabledPremiumModules } from "../../lib/premiumModules";

// Premium integrations (e.g. Eurocom International) aren't part of this
// open-source checkout — their source lives in the private
// ecommnode-premium repo and is only vendored locally into
// app/src/premium/<name>/index.jsx (gitignored). If that folder is absent,
// the glob simply matches nothing and no premium cards render. Which of
// the present ones actually render for this company is further gated by
// firme.enabled_premium_modules (see lib/premiumModules) — e.g. Eurocom's
// integration should only show up for the Eurocom account, not everyone.
const premiumModules = import.meta.glob("../../premium/*/index.jsx", { eager: true });

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
  const { enabledPremiumModules, loading: premiumLoading } = useEnabledPremiumModules();
  const PREMIUM_INTEGRATIONS = filterEntitledModules(premiumModules, enabledPremiumModules).map(
    ([key, mod]) => ({ key, Component: mod.default })
  );

  const [wooConnections, setWooConnections] = useState([]);
  const [showWooModal, setShowWooModal] = useState(false);
  const [shopifyConnections, setShopifyConnections] = useState([]);
  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [premiumCounts, setPremiumCounts] = useState({});
  const [ga4Connections, setGa4Connections] = useState([]);
  const [showGa4Modal, setShowGa4Modal] = useState(false);
  const [gscConnections, setGscConnections] = useState([]);
  const [showGscModal, setShowGscModal] = useState(false);
  const [metaConnections, setMetaConnections] = useState([]);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [inboxConnections, setInboxConnections] = useState([]);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showViberModal, setShowViberModal] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  // All six connection statuses load together under one gate — a card
  // (Eurocom included, via premiumLoading) used to pop into the grid
  // whenever ITS OWN fetch happened to finish, reflowing everything
  // already on screen. Promise.all means nothing renders until every
  // status is known, so the grid paints once, fully formed.
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const pageLoading = connectionsLoading || premiumLoading;

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    const empty = { connections: [] };
    Promise.all([
      fetchWooStatus().catch(() => empty),
      fetchShopifyStatus().catch(() => empty),
      fetchGa4Status().catch(() => empty),
      fetchGscStatus().catch(() => empty),
      fetchMetaStatus().catch(() => empty),
      fetchInboxConnections().catch(() => empty),
    ]).then(([woo, shopify, ga4, gsc, meta, inbox]) => {
      if (cancelled) return;
      setWooConnections(woo.connections || []);
      setShopifyConnections(shopify.connections || []);
      setGa4Connections(ga4.connections || []);
      setGscConnections(gsc.connections || []);
      setMetaConnections(meta.connections || []);
      setInboxConnections(inbox.connections || []);
      setConnectionsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleWooConnected = (connection) => {
    setWooConnections((prev) => [...prev, connection]);
    setShowWooModal(false);
  };

  const handleWooDisconnected = (id) => {
    setWooConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const handleShopifyConnected = (connection) => {
    setShopifyConnections((prev) => [...prev, connection]);
    setShowShopifyModal(false);
  };

  const handleShopifyDisconnected = (id) => {
    setShopifyConnections((prev) => prev.filter((c) => c.id !== id));
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

  const handleMetaConnected = (connection) => {
    setMetaConnections((prev) => [...prev, connection]);
    setShowMetaModal(false);
  };

  const handleMetaDisconnected = (id) => {
    setMetaConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const handleMetaUpdated = (connection) => {
    setMetaConnections((prev) => prev.map((c) => (c.id === connection.id ? connection : c)));
  };

  const handleInboxConnected = (connection) => {
    setInboxConnections((prev) => [...prev, connection]);
    setShowWhatsAppModal(false);
    setShowViberModal(false);
  };

  const handleInboxDisconnected = (id) => {
    setInboxConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const whatsappConnections = inboxConnections.filter((c) => c.platform === "whatsapp");
  const viberConnections = inboxConnections.filter((c) => c.platform === "viber");

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
          Poveži EcommNode sa svojim online prodavnicama.
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

      {pageLoading ? (
        <div className="integration-grid">
          {[0, 1, 2].map((i) => (
            <div className="integration-grid-card order-skeleton" key={i}>
              <div className="skeleton-line" style={{ width: "40%" }} />
              <div className="skeleton-line" style={{ width: "80%" }} />
              <div className="skeleton-line" style={{ width: "50%" }} />
            </div>
          ))}
        </div>
      ) : filter === "moje" ? (
        <>
          {wooConnections.length > 0 && (
            <WooCommerceIntegration
              connections={wooConnections}
              onDisconnected={handleWooDisconnected}
              onConnectClick={() => setShowWooModal(true)}
              onResult={showToast}
            />
          )}

          {shopifyConnections.length > 0 && (
            <ShopifyIntegration
              connections={shopifyConnections}
              onDisconnected={handleShopifyDisconnected}
              onConnectClick={() => setShowShopifyModal(true)}
              onResult={showToast}
            />
          )}

          {PREMIUM_INTEGRATIONS.map(({ key, Component }) => (
            <Component
              key={key}
              view="moje"
              wooConnections={wooConnections}
              onResult={showToast}
              onCountChange={(n) => setPremiumCounts((prev) => ({ ...prev, [key]: n }))}
            />
          ))}

          {ga4Connections.length > 0 && (
            <Ga4Integration
              connections={ga4Connections}
              onDisconnected={handleGa4Disconnected}
              onConnectClick={() => setShowGa4Modal(true)}
              onResult={showToast}
            />
          )}

          {gscConnections.length > 0 && (
            <GscIntegration
              connections={gscConnections}
              onDisconnected={handleGscDisconnected}
              onConnectClick={() => setShowGscModal(true)}
              onResult={showToast}
            />
          )}

          {metaConnections.length > 0 && (
            <MetaIntegration
              connections={metaConnections}
              wooConnections={wooConnections}
              onDisconnected={handleMetaDisconnected}
              onConnectClick={() => setShowMetaModal(true)}
              onUpdated={handleMetaUpdated}
              onResult={showToast}
            />
          )}

          {whatsappConnections.length > 0 && (
            <InboxChannelIntegration
              platform="whatsapp"
              name="WhatsApp Business"
              connections={whatsappConnections}
              onDisconnected={handleInboxDisconnected}
              onConnectClick={() => setShowWhatsAppModal(true)}
              onResult={showToast}
            />
          )}

          {viberConnections.length > 0 && (
            <InboxChannelIntegration
              platform="viber"
              name="Viber"
              connections={viberConnections}
              onDisconnected={handleInboxDisconnected}
              onConnectClick={() => setShowViberModal(true)}
              onResult={showToast}
            />
          )}

          {myIntegrations.length === 0 &&
          wooConnections.length === 0 &&
          shopifyConnections.length === 0 &&
          Object.values(premiumCounts).every((n) => !n) &&
          ga4Connections.length === 0 &&
          gscConnections.length === 0 &&
          metaConnections.length === 0 &&
          inboxConnections.length === 0 ? (
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
              onClick={() => setShowWooModal(true)}
            >
              {wooConnections.length > 0 ? "+ Poveži još jednu" : "Poveži"}
            </button>
          </div>

          <div className="integration-grid-card">
            <span className="integration-badge">
              <img src={shopifyLogo} alt="Shopify" />
            </span>
            <p className="integration-grid-name">
              Shopify
              {shopifyConnections.length > 0 && (
                <span className="status-pill">{shopifyConnections.length}</span>
              )}
            </p>
            <p className="integration-grid-desc">
              Poveži svoju Shopify prodavnicu
            </p>
            <button
              type="button"
              className="integration-grid-action"
              onClick={() => setShowShopifyModal(true)}
            >
              {shopifyConnections.length > 0 ? "+ Poveži još jednu" : "Poveži"}
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
              disabled={wooConnections.length === 0}
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
              disabled={wooConnections.length === 0}
              onClick={() => setShowGscModal(true)}
            >
              {gscConnections.length > 0 ? "+ Poveži još jednu" : "Poveži"}
            </button>
            {wooConnections.length === 0 && (
              <p className="woo-field-hint">Prvo poveži WooCommerce prodavnicu.</p>
            )}
          </div>

          <div className="integration-grid-card">
            <span className="integration-badge">
              <img src={metaLogo} alt="Meta Ads" />
            </span>
            <p className="integration-grid-name">
              Meta Ads
              {metaConnections.length > 0 && (
                <span className="status-pill">{metaConnections.length}</span>
              )}
            </p>
            <p className="integration-grid-desc">Prati potrošnju i performanse Meta oglasa</p>
            <button
              type="button"
              className="integration-grid-action"
              disabled={wooConnections.length === 0}
              onClick={() => setShowMetaModal(true)}
            >
              {metaConnections.length > 0 ? "+ Poveži još jednu" : "Poveži"}
            </button>
            {wooConnections.length === 0 && (
              <p className="woo-field-hint">Prvo poveži WooCommerce prodavnicu.</p>
            )}
          </div>

          <div className="integration-grid-card">
            <span className="integration-badge">
              <PlatformBadge platform="whatsapp" />
            </span>
            <p className="integration-grid-name">
              WhatsApp Business
              {whatsappConnections.length > 0 && (
                <span className="status-pill">{whatsappConnections.length}</span>
              )}
            </p>
            <p className="integration-grid-desc">Primaj i odgovaraj na WhatsApp poruke u Porukama</p>
            <button
              type="button"
              className="integration-grid-action"
              onClick={() => setShowWhatsAppModal(true)}
            >
              {whatsappConnections.length > 0 ? "+ Poveži još jedan brend" : "Poveži"}
            </button>
          </div>

          <div className="integration-grid-card">
            <span className="integration-badge">
              <PlatformBadge platform="viber" />
            </span>
            <p className="integration-grid-name">
              Viber
              {viberConnections.length > 0 && (
                <span className="status-pill">{viberConnections.length}</span>
              )}
            </p>
            <p className="integration-grid-desc">Primaj i odgovaraj na Viber poruke u Porukama</p>
            <button
              type="button"
              className="integration-grid-action"
              onClick={() => setShowViberModal(true)}
            >
              {viberConnections.length > 0 ? "+ Poveži još jedan brend" : "Poveži"}
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

      {showShopifyModal && (
        <ShopifyConnectModal
          onClose={() => setShowShopifyModal(false)}
          onConnected={handleShopifyConnected}
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

      {showMetaModal && (
        <MetaConnectModal
          wooConnections={wooConnections}
          onClose={() => setShowMetaModal(false)}
          onConnected={handleMetaConnected}
          onResult={showToast}
        />
      )}

      {showWhatsAppModal && (
        <InboxChannelConnectModal
          platform="whatsapp"
          onClose={() => setShowWhatsAppModal(false)}
          onConnected={handleInboxConnected}
          onResult={showToast}
        />
      )}

      {showViberModal && (
        <InboxChannelConnectModal
          platform="viber"
          onClose={() => setShowViberModal(false)}
          onConnected={handleInboxConnected}
          onResult={showToast}
        />
      )}

      <Toast type={toast?.type} message={toast?.message} />
    </>
  );
}
