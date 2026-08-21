import { useState } from "react";
import woocommerceLogo from "../assets/woocommerce.png";
import { disconnectWoo } from "../api/woocommerce";

export default function WooCommerceIntegration({ connection, onDisconnected, onResult }) {
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
    <div className="woo-integration-card">
      <div className="woo-integration-head">
        <span className="integration-badge">
          <img src={woocommerceLogo} alt="WooCommerce" />
        </span>
        <div className="integration-info">
          <p className="integration-name">
            WooCommerce
            <span className="status-pill">Povezano</span>
          </p>
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
