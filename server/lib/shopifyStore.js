const { createJsonFile } = require("./jsonFile");

const file = createJsonFile("shopify-connections.json", []);
let connections = file.read();

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

function updateConnection(id, company, patch) {
  connections = connections.map((c) =>
    c.id === id && c.company === company ? { ...c, ...patch } : c
  );
  file.write(connections);
  return getConnections(company).find((c) => c.id === id);
}

module.exports = { getConnections, addConnection, removeConnection, updateConnection };
