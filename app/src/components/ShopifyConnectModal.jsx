import { useState } from "react";
import { CloseIcon, EyeIcon, EyeOffIcon } from "../icons";
import { connectShopify } from "../api/shopify";

export default function ShopifyConnectModal({ onClose, onConnected, onResult }) {
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await connectShopify({ shopDomain, accessToken });
      onResult("success", `Uspešno povezano: ${data.connection.shopName}`);
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
        <h2 className="modal-title">Poveži Shopify</h2>
        <p className="modal-subtitle">
          Unesi pristupne podatke sa svoje Shopify prodavnice
        </p>
        <p className="woo-field-hint">
          U Shopify Adminu: Settings → Apps and sales channels → Develop apps
          → Create an app → uključi Admin API scope-ove{" "}
          <strong>read_orders</strong> i <strong>read_products</strong> →
          Install → kopiraj Admin API access token.
        </p>

        <form className="woo-form" onSubmit={handleSubmit}>
          <label className="woo-field">
            <span>Domen prodavnice</span>
            <input
              type="text"
              placeholder="tvoja-prodavnica.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              required
            />
          </label>

          <label className="woo-field">
            <span>Admin API Access Token</span>
            <div className="woo-secret-wrap">
              <input
                type={showToken ? "text" : "password"}
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                required
              />
              <button
                type="button"
                className="woo-secret-toggle"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? "Sakrij" : "Prikaži"}
              >
                {showToken ? <EyeOffIcon /> : <EyeIcon />}
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
