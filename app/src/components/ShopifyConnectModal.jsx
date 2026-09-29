import { useState } from "react";
import { CloseIcon, EyeIcon, EyeOffIcon } from "../icons";
import { connectShopify } from "../api/shopify";

export default function ShopifyConnectModal({ onClose, onConnected, onResult }) {
  const [shopDomain, setShopDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await connectShopify({ shopDomain, clientId, clientSecret });
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
          → Build apps in Dev Dashboard → Create app. Posle kreiranja,
          instaliraj aplikaciju na prodavnicu i uključi Admin API scope-ove{" "}
          <strong>read_orders</strong> i <strong>read_products</strong>. Zatim
          u App settings → Credentials kopiraj{" "}
          <strong>Client ID</strong> i <strong>Client Secret</strong> (Shopify
          od januara 2026. više ne prikazuje gotov access token za nove
          aplikacije — samo ova dva podatka).
        </p>
        <p className="woo-field-hint">
          Bez dodatnog scope-a <strong>read_all_orders</strong>, Shopify
          vraća porudžbine samo iz poslednjih 60 dana, bez obzira na period
          koji EcommNode traži. Za punu istoriju, u App settings → API access
          zatraži <strong>read_all_orders</strong> (App access requests →
          Read all orders → Request access) — to mora ručno da odobri
          Shopify, pa ponovo sinhronizuj posle odobrenja.
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
          <p className="woo-field-hint">
            Unesi *.myshopify.com domen (Shopify Admin → Settings → Domains),
            ne svoj custom/kupljen domen prodavnice — npr. ne{" "}
            <em>tvoja-prodavnica.com</em>, već{" "}
            <em>tvoja-prodavnica.myshopify.com</em>.
          </p>

          <label className="woo-field">
            <span>Client ID</span>
            <input
              type="text"
              placeholder="Client ID iz Dev Dashboard-a"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            />
          </label>

          <label className="woo-field">
            <span>Client Secret</span>
            <div className="woo-secret-wrap">
              <input
                type={showSecret ? "text" : "password"}
                placeholder="Client Secret iz Dev Dashboard-a"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
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
