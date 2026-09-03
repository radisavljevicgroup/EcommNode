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

module.exports = { getConnections, addConnection, removeConnection };
