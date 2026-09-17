import { useState } from "react";
import { CloseIcon } from "../icons";
import { siteLabel } from "../utils/site";
import { googleLogin } from "../lib/googleOAuth";
import { connectGa4 } from "../api/ga4";
import InfoTooltip from "./InfoTooltip";

export default function Ga4ConnectModal({ wooConnections, onClose, onConnected, onResult }) {
  const [stage, setStage] = useState("idle"); // idle | loading | picker | error
  const [properties, setProperties] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const [googleEmail, setGoogleEmail] = useState(null);
  const [labels, setLabels] = useState({});
  const [targetConnectionId, setTargetConnectionId] = useState(wooConnections[0]?.id || "");
  const [error, setError] = useState("");
  const [connectingId, setConnectingId] = useState(null);

  const handleLogin = async () => {
    setStage("loading");
    setError("");
    try {
      const data = await googleLogin("ga4");
      const items = data.items || [];
      setProperties(items);
      setPendingId(data.pendingId);
      setGoogleEmail(data.email || null);
      setLabels(Object.fromEntries(items.map((p) => [p.propertyId, p.displayName || p.propertyId])));
      setStage("picker");
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  };

  const handleConnect = async (property) => {
    if (!targetConnectionId) return;
    const label = (labels[property.propertyId] || property.displayName || property.propertyId).trim();
    if (!label) return;
    setConnectingId(property.propertyId);
    try {
      const data = await connectGa4({
        label,
        pendingId,
        propertyId: property.propertyId,
        targetConnectionId,
      });
      onResult("success", `GA4 povezan: ${data.connection.label}`);
      onConnected(data.connection);
      // Row disappears from the picker once connected — same reasoning as
      // MetaAdsConnectModal: reflects it stayed connected without needing
      // to close/reopen the modal to see that.
      setProperties((prev) => prev.filter((p) => p.propertyId !== property.propertyId));
    } catch (err) {
      onResult("error", "Neuspešno povezivanje: " + err.message);
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Zatvori">
          <CloseIcon />
        </button>
        <h2 className="modal-title">Poveži Google Analytics 4</h2>
        <p className="modal-subtitle">Izaberi GA4 property — prijavi se svojim Google nalogom.</p>

        {(stage === "idle" || stage === "error") && (
          <>
            {error && <div className="woo-error">{error}</div>}
            <button
              type="button"
              className="btn-save woo-submit"
              onClick={handleLogin}
              disabled={wooConnections.length === 0}
            >
              Poveži se sa Google nalogom
            </button>
            {wooConnections.length === 0 && (
              <p className="woo-field-hint">Prvo poveži WooCommerce prodavnicu.</p>
            )}
          </>
        )}

        {stage === "loading" && <div className="empty-hint">Učitavanje GA4 property-ja…</div>}

        {stage === "picker" && (
          <>
            {googleEmail && <p className="woo-field-hint">Prijavljen kao: {googleEmail}</p>}

            <label className="woo-field">
              <span className="woo-field-label-row">
                Prodavnica
                <InfoTooltip text="WooCommerce prodavnica kojoj pripada izabrani GA4 property." />
              </span>
              <select
                value={targetConnectionId}
                onChange={(e) => setTargetConnectionId(e.target.value)}
                required
              >
                {wooConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {siteLabel(c.siteUrl)}
                  </option>
                ))}
              </select>
            </label>

            {properties.length === 0 ? (
              <div className="empty-hint">
                Nijedan GA4 property nije pronađen. Proveri da imaš bar Viewer pristup nekom
                property-ju sa tim Google nalogom.
              </div>
            ) : (
              <div className="woo-form">
                {properties.map((property) => (
                  <div className="meta-account-row" key={property.propertyId}>
                    <div className="meta-account-row-main">
                      <input
                        type="text"
                        className="settings-input"
                        value={labels[property.propertyId] ?? ""}
                        onChange={(e) =>
                          setLabels((prev) => ({ ...prev, [property.propertyId]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-save"
                        onClick={() => handleConnect(property)}
                        disabled={connectingId === property.propertyId || !targetConnectionId}
                      >
                        {connectingId === property.propertyId ? "Povezivanje…" : "Poveži"}
                      </button>
                    </div>
                    <p className="woo-field-hint">
                      ID: {property.propertyId}
                      {property.accountName ? ` · ${property.accountName}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="integration-edit" onClick={handleLogin}>
              Osveži listu
            </button>
          </>
        )}
      </div>
    </div>
  );
}
