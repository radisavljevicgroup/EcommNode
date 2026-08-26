import { useState } from "react";
import googleSearchConsoleLogo from "../assets/google-search-console.jpg";
import { disconnectGsc } from "../api/gsc";
import { siteLabel } from "../utils/site";

export default function GscIntegration({ connection, onDisconnected, onResult }) {
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
    <div className="woo-integration-card">
      <div className="woo-integration-head">
        <span className="integration-badge">
          <img src={googleSearchConsoleLogo} alt="Google Search Console" />
        </span>
        <div className="integration-info">
          <p className="integration-name">
            {connection.label}
            <span className="status-pill">Povezano</span>
          </p>
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
