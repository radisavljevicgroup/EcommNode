import { useState } from "react";
import { CloseIcon } from "../icons";
import { siteLabel } from "../utils/site";
import { googleLogin } from "../lib/googleOAuth";
import { connectGsc } from "../api/gsc";
import InfoTooltip from "./InfoTooltip";

export default function GscConnectModal({ wooConnections, onClose, onConnected, onResult }) {
  const [stage, setStage] = useState("idle"); // idle | loading | picker | error
  const [sites, setSites] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const [googleEmail, setGoogleEmail] = useState(null);
  const [labels, setLabels] = useState({});
  const [targetConnectionId, setTargetConnectionId] = useState(wooConnections[0]?.id || "");
  const [error, setError] = useState("");
  const [connectingUrl, setConnectingUrl] = useState(null);

  const handleLogin = async () => {
    setStage("loading");
    setError("");
    try {
      const data = await googleLogin("gsc");
      const items = data.items || [];
      setSites(items);
      setPendingId(data.pendingId);
      setGoogleEmail(data.email || null);
      setLabels(Object.fromEntries(items.map((s) => [s.siteUrl, s.siteUrl])));
      setStage("picker");
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  };

  const handleConnect = async (site) => {
    if (!targetConnectionId) return;
    const label = (labels[site.siteUrl] || site.siteUrl).trim();
    if (!label) return;
    setConnectingUrl(site.siteUrl);
    try {
      const data = await connectGsc({
        label,
        pendingId,
        siteUrl: site.siteUrl,
        targetConnectionId,
      });
      onResult("success", `Search Console povezan: ${data.connection.label}`);
      onConnected(data.connection);
      // Row disappears from the picker once connected — same reasoning as
      // MetaAdsConnectModal: reflects it stayed connected without needing
      // to close/reopen the modal to see that.
      setSites((prev) => prev.filter((s) => s.siteUrl !== site.siteUrl));
    } catch (err) {
      onResult("error", "Neuspešno povezivanje: " + err.message);
    } finally {
      setConnectingUrl(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Zatvori">
          <CloseIcon />
        </button>
        <h2 className="modal-title">Poveži Google Search Console</h2>
        <p className="modal-subtitle">Izaberi sajt — prijavi se svojim Google nalogom.</p>

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

        {stage === "loading" && <div className="empty-hint">Učitavanje sajtova…</div>}

        {stage === "picker" && (
          <>
            {googleEmail && <p className="woo-field-hint">Prijavljen kao: {googleEmail}</p>}

            <label className="woo-field">
              <span className="woo-field-label-row">
                Prodavnica
                <InfoTooltip text="WooCommerce prodavnica kojoj pripada izabrani sajt u Search Console-u." />
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

            {sites.length === 0 ? (
              <div className="empty-hint">
                Nijedan verifikovan sajt nije pronađen. Proveri da imaš pristup bar jednom sajtu u
                Search Console-u sa tim Google nalogom.
              </div>
            ) : (
              <div className="woo-form">
                {sites.map((site) => (
                  <div className="meta-account-row" key={site.siteUrl}>
                    <div className="meta-account-row-main">
                      <input
                        type="text"
                        className="settings-input"
                        value={labels[site.siteUrl] ?? ""}
                        onChange={(e) =>
                          setLabels((prev) => ({ ...prev, [site.siteUrl]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-save"
                        onClick={() => handleConnect(site)}
                        disabled={connectingUrl === site.siteUrl || !targetConnectionId}
                      >
                        {connectingUrl === site.siteUrl ? "Povezivanje…" : "Poveži"}
                      </button>
                    </div>
                    <p className="woo-field-hint">
                      {site.siteUrl}
                      {site.permissionLevel ? ` · ${site.permissionLevel}` : ""}
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
