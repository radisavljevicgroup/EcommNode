import { useState } from "react";
import { CloseIcon } from "../icons";
import { siteLabel } from "../utils/site";
import { connectMeta } from "../api/meta";
import InfoTooltip from "./InfoTooltip";
import MultiSelect from "./MultiSelect";

function FieldLabel({ text, hint }) {
  return (
    <span className="woo-field-label-row">
      {text}
      <InfoTooltip text={hint} />
    </span>
  );
}

export default function MetaConnectModal({ wooConnections, onClose, onConnected, onResult }) {
  const [label, setLabel] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  // Defaults to every store — the common case is one Business Manager ad
  // account running campaigns for the whole portfolio, not just one site.
  const [targetConnectionIds, setTargetConnectionIds] = useState(wooConnections.map((c) => c.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (targetConnectionIds.length === 0) {
      setError("Izaberi bar jednu prodavnicu.");
      return;
    }
    setLoading(true);
    try {
      const data = await connectMeta({
        label: label || undefined,
        accessToken,
        adAccountId,
        targetConnectionIds,
      });
      onResult("success", `Meta Ads povezan: ${data.connection.label}`);
      onConnected(data.connection);
    } catch (err) {
      setError(err.message);
      onResult("error", "Neuspešno povezivanje: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const storeOptions = wooConnections.map((c) => ({ id: c.id, label: siteLabel(c.siteUrl) }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Zatvori">
          <CloseIcon />
        </button>
        <h2 className="modal-title">Poveži Meta Ads</h2>
        <p className="modal-subtitle">
          Poveži Meta (Facebook/Instagram) oglasni nalog preko access token-a sa dozvolom ads_read.
        </p>

        <form className="woo-form" onSubmit={handleSubmit}>
          <label className="woo-field">
            <FieldLabel
              text="Naziv veze (opciono)"
              hint="Naziv po kom ćeš prepoznati ovu vezu u listi integracija."
            />
            <input
              type="text"
              placeholder="npr. Meta Ads — glavni nalog"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>

          <label className="woo-field">
            <FieldLabel
              text="Ad Account ID"
              hint="ID oglasnog naloga iz Meta Ads Manager-a (Podešavanja naloga, gore levo) — unesi samo brojeve, bez 'act_' prefiksa."
            />
            <input
              type="text"
              placeholder="123456789012345"
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value.replace(/[^\d]/g, ""))}
              required
            />
          </label>

          <label className="woo-field">
            <FieldLabel
              text="Access token"
              hint="Dugotrajni (System User) access token sa dozvolom ads_read za ovaj oglasni nalog. Generiše se u Meta Business Suite → Business Settings → System Users → Generate New Token."
            />
            <textarea
              className="woo-textarea"
              placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              rows={3}
              required
            />
          </label>

          <label className="woo-field">
            <FieldLabel
              text="Prodavnice"
              hint="Sve WooCommerce prodavnice kojima ovaj oglasni nalog vodi kampanje — izaberi jednu ili više. Isti nalog se može povezati sa celim portfolijom odjednom."
            />
            <MultiSelect
              options={storeOptions}
              selected={targetConnectionIds}
              onChange={setTargetConnectionIds}
              placeholder="Izaberi prodavnice"
              showSelectAll
            />
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
