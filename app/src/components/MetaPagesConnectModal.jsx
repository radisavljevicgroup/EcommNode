import { useState } from "react";
import { CloseIcon } from "../icons";
import { facebookLogin } from "../lib/facebookSdk";
import { fetchManagedFacebookPages, connectInboxChannel } from "../api/inboxConnections";

// Every permission either channel below could need — requesting the union
// up front means the same popup/login covers both "Facebook Messenger" and
// "Instagram Direct" cards without asking the merchant to log in twice.
const SCOPE = "pages_show_list,pages_messaging,instagram_basic,instagram_manage_messages";

const CONFIG = {
  facebook: {
    title: "Poveži se sa Facebook-om",
    subtitle: "Izaberi Facebook stranicu — poruke stižu u isti Poruke inbox.",
    emptyHint:
      "Nijedna stranica nije pronađena. Proveri da si Admin na bar jednoj Facebook stranici sa tim nalogom.",
  },
  instagram: {
    title: "Poveži se sa Facebook-om",
    subtitle:
      "Izaberi Instagram Business nalog — mora biti povezan na Facebook stranicu (Meta Business Suite → Podešavanja → Nalozi).",
    emptyHint:
      "Nijedan Instagram Business nalog nije pronađen. Proveri da je tvoj Instagram nalog povezan na Facebook stranicu čiji si Admin.",
  },
};

// Turns the raw /me/accounts-derived page list into the rows this modal
// actually offers to connect — for Instagram that means only pages with a
// linked Instagram professional account, and connecting by that account's
// id (not the page's), even though the token used is still the Page token.
function rowsFor(platform, pages) {
  if (platform === "instagram") {
    return pages
      .filter((p) => p.instagram)
      .map((p) => ({
        pageAccessToken: p.accessToken,
        pageId: p.instagram.id,
        defaultLabel: p.instagram.username || p.name,
      }));
  }
  return pages.map((p) => ({
    pageAccessToken: p.accessToken,
    pageId: p.id,
    defaultLabel: p.name,
  }));
}

export default function MetaPagesConnectModal({ platform, onClose, onConnected, onResult }) {
  const config = CONFIG[platform];
  const [stage, setStage] = useState("idle"); // idle | loading | picker | error
  const [rows, setRows] = useState([]);
  const [labels, setLabels] = useState({});
  const [error, setError] = useState("");
  const [connectingId, setConnectingId] = useState(null);

  const handleLogin = async () => {
    setStage("loading");
    setError("");
    try {
      const userAccessToken = await facebookLogin(SCOPE);
      const { pages } = await fetchManagedFacebookPages(userAccessToken);
      const nextRows = rowsFor(platform, pages || []);
      setRows(nextRows);
      setLabels(Object.fromEntries(nextRows.map((r) => [r.pageId, r.defaultLabel])));
      setStage("picker");
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  };

  const handleConnect = async (row) => {
    const label = (labels[row.pageId] || row.defaultLabel).trim();
    if (!label) return;
    setConnectingId(row.pageId);
    try {
      const data = await connectInboxChannel({
        label,
        platform,
        pageId: row.pageId,
        accessToken: row.pageAccessToken,
      });
      onResult("success", data.webhookWarning || `${label} povezan.`);
      onConnected(data.connection);
      // Row disappears from the picker once connected — reflects it stayed
      // connected without needing to close/reopen the modal to see that.
      setRows((prev) => prev.filter((r) => r.pageId !== row.pageId));
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
        <h2 className="modal-title">{config.title}</h2>
        <p className="modal-subtitle">{config.subtitle}</p>

        {(stage === "idle" || stage === "error") && (
          <>
            {error && <div className="woo-error">{error}</div>}
            <button type="button" className="btn-save woo-submit" onClick={handleLogin}>
              Poveži se sa Facebook-om
            </button>
          </>
        )}

        {stage === "loading" && <div className="empty-hint">Učitavanje stranica…</div>}

        {stage === "picker" && (
          <>
            {rows.length === 0 ? (
              <div className="empty-hint">{config.emptyHint}</div>
            ) : (
              <div className="woo-form">
                {rows.map((row) => (
                  <div className="meta-account-row" key={row.pageId}>
                    <div className="meta-account-row-main">
                      <input
                        type="text"
                        className="settings-input"
                        value={labels[row.pageId] ?? ""}
                        onChange={(e) =>
                          setLabels((prev) => ({ ...prev, [row.pageId]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-save"
                        onClick={() => handleConnect(row)}
                        disabled={connectingId === row.pageId}
                      >
                        {connectingId === row.pageId ? "Povezivanje…" : "Poveži"}
                      </button>
                    </div>
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
