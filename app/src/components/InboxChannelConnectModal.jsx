import { useState } from "react";
import { CloseIcon } from "../icons";
import { connectInboxChannel } from "../api/inboxConnections";
import InfoTooltip from "./InfoTooltip";

// WhatsApp and Viber connect through the same "brand + access token" shape
// as every other per-brand inbox connection — only the extra id field (and
// where the token comes from) differs between the two.
const CHANNEL_CONFIG = {
  whatsapp: {
    title: "Poveži WhatsApp Business",
    subtitle: "Poveži WhatsApp Business broj za jedan brend — poruke stižu u isti Poruke inbox.",
    idField: {
      key: "phoneNumberId",
      label: "Phone Number ID",
      hint: "Meta App Dashboard → WhatsApp → API Setup — ID broja telefona (nije sam broj).",
      placeholder: "102938475601234",
    },
    tokenLabel: "Access token",
    tokenHint:
      "Trajni (System User) token sa whatsapp_business_messaging dozvolom — App Dashboard → WhatsApp → API Setup, ili Business Settings → System Users → Generate New Token.",
    tokenPlaceholder: "EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  viber: {
    title: "Poveži Viber",
    subtitle: "Poveži Viber Bot nalog za jedan brend — poruke stižu u isti Poruke inbox.",
    idField: null,
    tokenLabel: "Auth Token",
    tokenHint:
      "Auth Token tvog Viber bota — Viber Admin Panel (partners.viber.com) → tvoj Public Account → Bot Settings. EcommNode sam registruje webhook čim ga uneseš.",
    tokenPlaceholder: "45f5c927exxxxxxx-xxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx",
  },
};

export default function InboxChannelConnectModal({ platform, onClose, onConnected, onResult }) {
  const config = CHANNEL_CONFIG[platform];
  const [label, setLabel] = useState("");
  const [idValue, setIdValue] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const channelName = config.title.replace("Poveži ", "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = { label, platform, accessToken };
      if (config.idField) payload[config.idField.key] = idValue;

      const data = await connectInboxChannel(payload);
      // The connection itself always saved successfully here (a real
      // failure throws below) — webhookWarning just means Viber's
      // auto-registration step needs a manual follow-up, not that
      // connecting failed.
      onResult("success", data.webhookWarning || `${channelName} povezan: ${data.connection.label}`);
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
        <h2 className="modal-title">{config.title}</h2>
        <p className="modal-subtitle">{config.subtitle}</p>

        <form className="woo-form" onSubmit={handleSubmit}>
          <label className="woo-field">
            <span className="woo-field-label-row">
              Naziv brenda
              <InfoTooltip text="Prikazuje se u sidebaru Poruka, ispod slike pošiljaoca — npr. Parker, Papagaj, Maped." />
            </span>
            <input
              type="text"
              placeholder="npr. Parker"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </label>

          {config.idField && (
            <label className="woo-field">
              <span className="woo-field-label-row">
                {config.idField.label}
                <InfoTooltip text={config.idField.hint} />
              </span>
              <input
                type="text"
                placeholder={config.idField.placeholder}
                value={idValue}
                onChange={(e) => setIdValue(e.target.value)}
                required
              />
            </label>
          )}

          <label className="woo-field">
            <span className="woo-field-label-row">
              {config.tokenLabel}
              <InfoTooltip text={config.tokenHint} />
            </span>
            <textarea
              className="woo-textarea"
              placeholder={config.tokenPlaceholder}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              rows={3}
              required
            />
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
