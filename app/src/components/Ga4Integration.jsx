import { useState } from "react";
import googleAnalyticsLogo from "../assets/google-analytics.png";
import { disconnectGa4 } from "../api/ga4";
import { siteLabel } from "../utils/site";

export default function Ga4Integration({ connection, onDisconnected, onResult }) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await disconnectGa4(connection.id);
      onResult("success", `Integracija uklonjena: ${connection.label}`);
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
          <img src={googleAnalyticsLogo} alt="Google Analytics 4" />
        </span>
        <div className="integration-info">
          <p className="integration-name">
            {connection.label}
            <span className="status-pill">Povezano</span>
          </p>
          <p className="integration-site">
            Property {connection.propertyId} → {siteLabel(connection.targetSiteUrl)}
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
