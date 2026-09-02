import { useState } from "react";
import PlatformBadge from "./PlatformBadge";
import { disconnectInboxChannel } from "../api/inboxConnections";
import IntegrationGroupCard from "./IntegrationGroupCard";

function ConnectionRow({ connection, onDisconnected, onResult }) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await disconnectInboxChannel(connection.id);
      onResult("success", `Integracija uklonjena: ${connection.label}`);
      onDisconnected(connection.id);
    } catch (err) {
      setRemoving(false);
      onResult("error", "Neuspešno uklanjanje integracije: " + err.message);
    }
  };

  return (
    <div className="meta-account-row">
      <div className="meta-account-row-main">
        <div className="integration-info">
          <p className="integration-name">{connection.label}</p>
          <p className="integration-site">
            {connection.platform === "whatsapp"
              ? `Broj: ${connection.phoneNumberId}`
              : connection.webhookUrl}
          </p>
        </div>
        <button className="integration-remove" type="button" onClick={handleRemove} disabled={removing}>
          {removing ? "Uklanjanje…" : "Ukloni"}
        </button>
      </div>
    </div>
  );
}

// One reusable "my integrations" card for both WhatsApp and Viber — same
// shape as MetaIntegration (multiple brand connections under one channel),
// just without Meta Ads' per-connection store-targeting editor.
export default function InboxChannelIntegration({ platform, name, connections, onDisconnected, onConnectClick, onResult }) {
  return (
    <IntegrationGroupCard
      iconNode={<PlatformBadge platform={platform} />}
      name={name}
      connections={connections}
      countLabel={(n) => `${n} ${n === 1 ? "brend povezan" : "brenda povezano"}`}
      addLabel="+ Dodaj brend"
      onConnectClick={onConnectClick}
      renderRow={(connection) => (
        <ConnectionRow key={connection.id} connection={connection} onDisconnected={onDisconnected} onResult={onResult} />
      )}
    />
  );
}
