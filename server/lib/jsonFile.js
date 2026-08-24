const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function createJsonFile(filename, defaultValue) {
  const filePath = path.join(DATA_DIR, filename);

  function read() {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return defaultValue;
    }
  }

  function write(value) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  }

  return { read, write };
}

module.exports = { createJsonFile };
