import { useState } from "react";
import { CloseIcon } from "../icons";
import { siteLabel } from "../utils/site";
import { connectGsc } from "../api/gsc";
import InfoTooltip from "./InfoTooltip";

function FieldLabel({ text, hint }) {
  return (
    <span className="woo-field-label-row">
      {text}
      <InfoTooltip text={hint} />
    </span>
  );
}

export default function GscConnectModal({ wooConnections, onClose, onConnected, onResult }) {
  const [label, setLabel] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [targetConnectionId, setTargetConnectionId] = useState(wooConnections[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await connectGsc({
        label: label || undefined,
        siteUrl,
        serviceAccountJson,
        targetConnectionId,
      });
      onResult("success", `Search Console povezan: ${data.connection.label}`);
      onConnected(data.connection);
    } catch (err) {
      setError(err.message);
      onResult("error", "Neuspešno povezivanje: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Zatvori">
          <CloseIcon />
        </button>
        <h2 className="modal-title">Poveži Google Search Console</h2>
        <p className="modal-subtitle">
          Poveži sajt preko service account-a — isti nalog treba da bude dodat kao korisnik
          tog sajta u Search Console-u.
        </p>

        <form className="woo-form" onSubmit={handleSubmit}>
          <label className="woo-field">
            <FieldLabel
              text="Naziv veze (opciono)"
              hint="Naziv po kom ćeš prepoznati ovu vezu u listi integracija."
            />
            <input
              type="text"
              placeholder="npr. GSC — parkerolovke.rs"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>

          <label className="woo-field">
            <FieldLabel
              text="URL sajta"
              hint="Tačno onako kako je verifikovan u Search Console-u, npr. https://parkerolovke.rs/ ili sc-domain:parkerolovke.rs"
            />
            <input
              type="text"
              placeholder="https://parkerolovke.rs/"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              required
            />
          </label>

          <label className="woo-field">
            <FieldLabel
              text="Service account JSON ključ"
              hint="Kreiraj service account u Google Cloud Console-u (IAM & Admin > Service Accounts), preuzmi JSON ključ i nalepi ga ovde. Njegov client_email zatim dodaj kao korisnika sajta u Search Console > Settings > Users and permissions."
            />
            <textarea
              className="woo-textarea"
              placeholder='{ "type": "service_account", "client_email": "...", "private_key": "..." }'
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              rows={5}
              required
            />
          </label>

          <label className="woo-field">
            <FieldLabel
              text="Prodavnica"
              hint="WooCommerce prodavnica kojoj pripada ovaj sajt u Search Console-u."
            />
            <select
              value={targetConnectionId}
              onChange={(e) => setTargetConnectionId(e.target.value)}
              required
            >
              {wooConnections.length === 0 && (
                <option value="">Nema povezanih prodavnica</option>
              )}
              {wooConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {siteLabel(c.siteUrl)}
                </option>
              ))}
            </select>
          </label>

          {error && <div className="woo-error">{error}</div>}

          <button
            className="btn-save woo-submit"
            type="submit"
            disabled={loading || wooConnections.length === 0}
          >
            {loading ? "Povezivanje…" : "Poveži"}
          </button>
        </form>
      </div>
    </div>
  );
}
