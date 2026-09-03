const { createJsonFile } = require("./jsonFile");

const file = createJsonFile("gsc-connections.json", []);
let connections = file.read();

function getConnections(company) {
  return connections.filter((c) => c.company === company);
}

function getConnection(id, company) {
  return connections.find((c) => c.id === id && c.company === company) || null;
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

module.exports = { getConnections, getConnection, addConnection, removeConnection };
