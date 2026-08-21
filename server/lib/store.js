const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "connections.json");

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeFile(connections) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(connections, null, 2));
}

let connections = readFile();

function getConnections() {
  return connections;
}

function addConnection(connection) {
  connections = [...connections, connection];
  writeFile(connections);
  return connections;
}

function removeConnection(id) {
  connections = connections.filter((c) => c.id !== id);
  writeFile(connections);
  return connections;
}

module.exports = { getConnections, addConnection, removeConnection };
