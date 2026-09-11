import { useState } from "react";
import { CloseIcon } from "../icons";
import { facebookLogin } from "../lib/facebookSdk";
import { fetchManagedAdAccounts, connectMeta } from "../api/meta";

// ads_read is enough for reporting (spend/insights) — ads_management would
// only be needed if this ever creates/edits campaigns, which it doesn't.
const SCOPE = "ads_read";

export default function MetaAdsConnectModal({ wooConnections, onClose, onConnected, onResult }) {
  const [stage, setStage] = useState("idle"); // idle | loading | picker | error
  const [accounts, setAccounts] = useState([]);
  const [longLivedToken, setLongLivedToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [labels, setLabels] = useState({});
  const [error, setError] = useState("");
  const [connectingId, setConnectingId] = useState(null);

  // Defaults to every store, same as the old manual form — the common case
  // is one Business Manager ad account running campaigns for the whole
  // portfolio, not just one site. Refinable per-account afterwards via
  // MetaIntegration.jsx's "Uredi prodavnice".
  const targetConnectionIds = wooConnections.map((c) => c.id);

  const handleLogin = async () => {
    setStage("loading");
    setError("");
    try {
      const userAccessToken = await facebookLogin(SCOPE);
      const data = await fetchManagedAdAccounts(userAccessToken);
      setAccounts(data.accounts || []);
      setLongLivedToken(data.longLivedToken);
      setTokenExpiresAt(data.tokenExpiresAt);
      setLabels(Object.fromEntries((data.accounts || []).map((a) => [a.id, a.name || a.id])));
      setStage("picker");
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  };

  const handleConnect = async (account) => {
    const label = (labels[account.id] || account.name || account.id).trim();
    if (!label) return;
    setConnectingId(account.id);
    try {
      const data = await connectMeta({
        label,
        accessToken: longLivedToken,
        adAccountId: account.id,
        targetConnectionIds,
        tokenExpiresAt,
      });
      onResult("success", `Meta Ads povezan: ${data.connection.label}`);
      onConnected(data.connection);
      // Row disappears from the picker once connected — same reasoning as
      // MetaPagesConnectModal: reflects it stayed connected without needing
      // to close/reopen the modal to see that.
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
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
        <h2 className="modal-title">Poveži Meta Ads</h2>
        <p className="modal-subtitle">Izaberi oglasni nalog — prijavi se svojim Meta nalogom.</p>

        {(stage === "idle" || stage === "error") && (
          <>
            {error && <div className="woo-error">{error}</div>}
            <button
              type="button"
              className="btn-save woo-submit"
              onClick={handleLogin}
              disabled={wooConnections.length === 0}
            >
              Poveži se sa Facebook-om
            </button>
            {wooConnections.length === 0 && (
              <p className="woo-field-hint">Prvo poveži WooCommerce prodavnicu.</p>
            )}
          </>
        )}

        {stage === "loading" && <div className="empty-hint">Učitavanje oglasnih naloga…</div>}

        {stage === "picker" && (
          <>
            {accounts.length === 0 ? (
              <div className="empty-hint">
                Nijedan oglasni nalog nije pronađen. Proveri da imaš pristup bar jednom nalogu u
                Meta Ads Manager-u sa tim nalogom.
              </div>
            ) : (
              <div className="woo-form">
                {accounts.map((account) => (
                  <div className="meta-account-row" key={account.id}>
                    <div className="meta-account-row-main">
                      <input
                        type="text"
                        className="settings-input"
                        value={labels[account.id] ?? ""}
                        onChange={(e) =>
                          setLabels((prev) => ({ ...prev, [account.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-save"
                        onClick={() => handleConnect(account)}
                        disabled={connectingId === account.id}
                      >
                        {connectingId === account.id ? "Povezivanje…" : "Poveži"}
                      </button>
                    </div>
                    {!account.active && (
                      <p className="woo-field-hint">Nalog trenutno nije aktivan u Meta Ads Manager-u.</p>
                    )}
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
