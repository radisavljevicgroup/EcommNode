// Tracks which of our Facebook Pages / Instagram business accounts /
// WhatsApp numbers belongs to which brand (Parker, Papagaj, Maped, ...) —
// same shape as store.js (WooCommerce) and metaStore.js (Meta Ads): a flat
// JSON file, one row per connected channel.
const { createJsonFile } = require("./jsonFile");

const file = createJsonFile("inbox-connections.json", []);
let connections = file.read();

function getConnections() {
  return connections;
}

function getConnection(id) {
  return connections.find((c) => c.id === id) || null;
}

// A Facebook Page and its linked Instagram business account normally
// share one Page Access Token but have two different ids — so lookups are
// always platform-scoped, never just "by pageId" alone.
function findByPageId(platform, pageId) {
  return connections.find((c) => c.platform === platform && c.pageId === pageId) || null;
}

function findByPhoneNumberId(phoneNumberId) {
  return connections.find((c) => c.platform === "whatsapp" && c.phoneNumberId === phoneNumberId) || null;
}

function addConnection(connection) {
  connections = [...connections, connection];
  file.write(connections);
  return connections;
}

function removeConnection(id) {
  connections = connections.filter((c) => c.id !== id);
  file.write(connections);
  return connections;
}

function updateConnection(id, patch) {
  connections = connections.map((c) => (c.id === id ? { ...c, ...patch } : c));
  file.write(connections);
  return getConnection(id);
}

module.exports = {
  getConnections,
  getConnection,
  findByPageId,
  findByPhoneNumberId,
  addConnection,
  removeConnection,
  updateConnection,
};
