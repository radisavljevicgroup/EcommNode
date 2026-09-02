const { createJsonFile } = require("./jsonFile");

const file = createJsonFile("meta-connections.json", []);
let connections = file.read();

function getConnections() {
  return connections;
}

function getConnection(id) {
  return connections.find((c) => c.id === id) || null;
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

module.exports = { getConnections, getConnection, addConnection, removeConnection, updateConnection };
