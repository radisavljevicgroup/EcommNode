import { useState } from "react";
import { CloseIcon, EyeIcon, EyeOffIcon } from "../icons";
import { connectWoo } from "../api/woocommerce";

export default function WooCommerceConnectModal({ onClose, onConnected, onResult }) {
  const [siteUrl, setSiteUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await connectWoo({ siteUrl, consumerKey, consumerSecret });
      onResult("success", `Uspešno povezano: ${data.connection.siteUrl}`);
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
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Zatvori"
        >
          <CloseIcon />
        </button>
        <h2 className="modal-title">Poveži WooCommerce</h2>
        <p className="modal-subtitle">
          Unesi pristupne podatke sa svog WooCommerce sajta
        </p>

        <form className="woo-form" onSubmit={handleSubmit}>
          <label className="woo-field">
            <span>URL sajta</span>
            <input
              type="url"
              placeholder="https://tvojsajt.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              required
            />
          </label>

          <label className="woo-field">
            <span>Consumer Key</span>
            <input
              type="text"
              placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
              required
            />
          </label>

          <label className="woo-field">
            <span>Consumer Secret</span>
            <div className="woo-secret-wrap">
              <input
                type={showSecret ? "text" : "password"}
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                required
              />
              <button
                type="button"
                className="woo-secret-toggle"
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? "Sakrij" : "Prikaži"}
              >
                {showSecret ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          {error && <div className="woo-error">{error}</div>}

          <button className="btn-save woo-submit" type="submit" disabled={loading}>
            {loading ? "Povezivanje…" : "Poveži"}
          </button>
        </form>
      </div>
    </div>
  );
}
