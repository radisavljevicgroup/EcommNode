const { createJsonFile } = require("./jsonFile");

const file = createJsonFile("connections.json", []);
let connections = file.read();

// Every getter/writer is scoped to the caller's company (see lib/auth.js) —
// without this, every registered account shared the exact same connection
// list regardless of which company they belong to.
function getConnections(company) {
  return connections.filter((c) => c.company === company);
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

// Unscoped — only for callers with no company of their own: the
// WooCommerce order webhook (routes/wooWebhooks.js) finds its store by the
// id in the delivery URL, and boot-time webhook registration walks them all.
function getConnectionById(id) {
  return connections.find((c) => c.id === id) || null;
}

function getAllConnections() {
  return connections;
}

module.exports = {
  getConnections,
  addConnection,
  removeConnection,
  getConnectionById,
  getAllConnections,
};
