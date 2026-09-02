import { useState } from "react";
import woocommerceLogo from "../assets/woocommerce.png";
import { disconnectWoo } from "../api/woocommerce";
import IntegrationGroupCard from "./IntegrationGroupCard";

function StoreRow({ connection, onDisconnected, onResult }) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await disconnectWoo(connection.id);
      onResult("success", `Integracija uklonjena: ${connection.siteUrl}`);
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
          <p className="integration-site">{connection.siteUrl}</p>
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

export default function WooCommerceIntegration({ connections, onDisconnected, onConnectClick, onResult }) {
  return (
    <IntegrationGroupCard
      icon={woocommerceLogo}
      iconAlt="WooCommerce"
      name="WooCommerce"
      connections={connections}
      countLabel={(n) => `${n} ${n === 1 ? "prodavnica povezana" : "prodavnica povezano"}`}
      addLabel="+ Dodaj prodavnicu"
      onConnectClick={onConnectClick}
      renderRow={(connection) => (
        <StoreRow
          key={connection.id}
          connection={connection}
          onDisconnected={onDisconnected}
          onResult={onResult}
        />
      )}
    />
  );
}
