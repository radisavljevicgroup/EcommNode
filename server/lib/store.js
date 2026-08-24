const { createJsonFile } = require("./jsonFile");

const file = createJsonFile("connections.json", []);
let connections = file.read();

function getConnections() {
  return connections;
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

module.exports = { getConnections, addConnection, removeConnection };
