const { createJsonFile } = require("./jsonFile");

const file = createJsonFile("meta-connections.json", []);
let connections = file.read();

function getConnections(company) {
  return connections.filter((c) => c.company === company);
}

function getConnection(id, company) {
  return connections.find((c) => c.id === id && c.company === company) || null;
}

// Unscoped — every connection, across every company. Only for the
// background token-refresh job (metaAdsTokenRefresh.js), same reasoning as
// Eurocom's getAllConnections: it runs outside any request, so it has no
// single req.company to filter by.
function getAllConnections() {
  return connections;
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
  return getConnection(id, company);
}

module.exports = {
  getConnections,
  getAllConnections,
  getConnection,
  addConnection,
  removeConnection,
  updateConnection,
};
