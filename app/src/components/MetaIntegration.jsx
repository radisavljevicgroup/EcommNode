import { useState } from "react";
import metaLogo from "../assets/meta.jpg";
import { disconnectMeta, updateMetaStores } from "../api/meta";
import { siteLabel } from "../utils/site";
import MultiSelect from "./MultiSelect";
import IntegrationGroupCard from "./IntegrationGroupCard";

function formatStores(siteUrls) {
  const urls = siteUrls || [];
  if (urls.length === 0) return "—";
  if (urls.length <= 3) return urls.map(siteLabel).join(", ");
  return `${urls.slice(0, 2).map(siteLabel).join(", ")} +${urls.length - 2} još`;
}

function AccountRow({ connection, wooConnections, onDisconnected, onUpdated, onResult }) {
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftIds, setDraftIds] = useState(connection.targetConnectionIds || []);
  const [saving, setSaving] = useState(false);

  const storeOptions = wooConnections.map((c) => ({ id: c.id, label: siteLabel(c.siteUrl) }));

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await disconnectMeta(connection.id);
      onResult("success", `Integracija uklonjena: ${connection.label}`);
      onDisconnected(connection.id);
    } catch (err) {
      setRemoving(false);
      onResult("error", "Neuspešno uklanjanje integracije: " + err.message);
    }
  };

  const startEdit = () => {
    setDraftIds(connection.targetConnectionIds || []);
    setEditing(true);
  };

  const handleSave = async () => {
    if (draftIds.length === 0) {
      onResult("error", "Izaberi bar jednu prodavnicu.");
      return;
    }
    setSaving(true);
    try {
      const data = await updateMetaStores(connection.id, draftIds);
      onUpdated(data.connection);
      onResult("success", "Prodavnice ažurirane.");
      setEditing(false);
    } catch (err) {
      onResult("error", "Neuspešno ažuriranje: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="meta-account-row">
      <div className="meta-account-row-main">
        <div className="integration-info">
          <p className="integration-name">{connection.label}</p>
          <p className="integration-site">
            {connection.accountName || `Nalog ${connection.adAccountId}`} → {formatStores(connection.targetSiteUrls)}
          </p>
        </div>
        <button className="integration-edit" type="button" onClick={startEdit} disabled={editing}>
          Uredi prodavnice
        </button>
        <button
          className="integration-remove"
          type="button"
          onClick={handleRemove}
          disabled={removing}
        >
          {removing ? "Uklanjanje…" : "Ukloni"}
        </button>
      </div>

      {editing && (
        <div className="meta-account-edit">
          <MultiSelect
            options={storeOptions}
            selected={draftIds}
            onChange={setDraftIds}
            placeholder="Izaberi prodavnice"
            showSelectAll
          />
          <div className="meta-account-edit-actions">
            <button className="btn-save" type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Čuvanje…" : "Sačuvaj"}
            </button>
            <button
              className="btn-cancel"
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Otkaži
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MetaIntegration({ connections, wooConnections, onDisconnected, onConnectClick, onUpdated, onResult }) {
  return (
    <IntegrationGroupCard
      icon={metaLogo}
      iconAlt="Meta Ads"
      name="Meta Ads"
      connections={connections}
      countLabel={(n) => `${n} ${n === 1 ? "nalog povezan" : "naloga povezano"}`}
      addLabel="+ Dodaj nalog"
      onConnectClick={onConnectClick}
      renderRow={(connection) => (
        <AccountRow
          key={connection.id}
          connection={connection}
          wooConnections={wooConnections}
          onDisconnected={onDisconnected}
          onUpdated={onUpdated}
          onResult={onResult}
        />
      )}
    />
  );
}
