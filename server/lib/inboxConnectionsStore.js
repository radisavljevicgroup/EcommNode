// Tracks which of our Facebook Pages / Instagram business accounts /
// WhatsApp numbers / Viber bots belongs to which brand — same shape as
// store.js (WooCommerce) and metaStore.js (Meta Ads): a flat JSON file,
// one row per connected channel.
const { createJsonFile } = require("./jsonFile");

const file = createJsonFile("inbox-connections.json", []);
let connections = file.read();

// Company-scoped — the merchant-facing list/add/remove/update routes.
function getConnections(company) {
  return connections.filter((c) => c.company === company);
}

// The next four lookups are deliberately NOT company-scoped: an inbound
// webhook (see routes/inbox.js) has no logged-in caller to scope by — it
// only has a platform id (Page id / phone_number_id / Viber connection id)
// and has to resolve which brand/company that belongs to *from* the
// connection itself, before a company is even known.
function getConnection(id) {
  return connections.find((c) => c.id === id) || null;
}

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

function removeConnection(id, company) {
  connections = connections.filter((c) => !(c.id === id && c.company === company));
  file.write(connections);
  return getConnections(company);
}

function updateConnection(id, company, patch) {
  connections = connections.map((c) =>
    c.id === id && c.company === company ? { ...c, ...patch } : c
  );
  file.write(connections);
  return connections.find((c) => c.id === id && c.company === company) || null;
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
