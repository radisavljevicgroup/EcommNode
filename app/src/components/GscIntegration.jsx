import { useState } from "react";
import googleSearchConsoleLogo from "../assets/google-search-console.jpg";
import { disconnectGsc } from "../api/gsc";
import { siteLabel } from "../utils/site";
import IntegrationGroupCard from "./IntegrationGroupCard";

function PropertyRow({ connection, onDisconnected, onResult }) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await disconnectGsc(connection.id);
      onResult("success", `Integracija uklonjena: ${connection.label}`);
      onDisconnected(connection.id);
    } catch (err) {
      setRemoving(false);
      onResult("error", "Neuspešno uklanjanje integracije: " + err.message);
    }
  };

  return (
    <div className="meta-account-row">
      <div className="meta-account-row-main">
        <div className="integration-info">
          <p className="integration-name">{connection.label}</p>
          <p className="integration-site">
            {connection.siteUrl} → {siteLabel(connection.targetSiteUrl)}
          </p>
        </div>
        <button
          className="integration-remove"
          type="button"
          onClick={handleRemove}
          disabled={removing}
        >
          {removing ? "Uklanjanje…" : "Ukloni integraciju"}
        </button>
      </div>
    </div>
  );
}

export default function GscIntegration({ connections, onDisconnected, onConnectClick, onResult }) {
  return (
    <IntegrationGroupCard
      icon={googleSearchConsoleLogo}
      iconAlt="Google Search Console"
      name="Google Search Console"
      connections={connections}
      countLabel={(n) => `${n} ${n === 1 ? "veza povezana" : "veze povezano"}`}
      addLabel="+ Poveži još jednu"
      onConnectClick={onConnectClick}
      renderRow={(connection) => (
        <PropertyRow
          key={connection.id}
          connection={connection}
          onDisconnected={onDisconnected}
          onResult={onResult}
        />
      )}
    />
  );
}
