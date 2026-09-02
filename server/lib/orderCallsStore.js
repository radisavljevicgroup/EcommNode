const { createJsonFile } = require("./jsonFile");

// Manually logged "we called this customer" counter for personal-pickup
// orders — keyed by connectionId+orderId since order ids aren't unique
// across different connected stores.
const file = createJsonFile("order-calls.json", {});
let counts = file.read();

function keyFor(connectionId, orderId) {
  return `${connectionId}:${orderId}`;
}

function getCallCount(connectionId, orderId) {
  return counts[keyFor(connectionId, orderId)] || 0;
}

function getCallCounts(connectionId) {
  const prefix = `${connectionId}:`;
  const result = {};
  for (const key of Object.keys(counts)) {
    if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = counts[key];
    }
  }
  return result;
}

function adjustCallCount(connectionId, orderId, delta) {
  const key = keyFor(connectionId, orderId);
  const next = Math.max(0, (counts[key] || 0) + delta);
  counts = { ...counts, [key]: next };
  file.write(counts);
  return next;
}

module.exports = { getCallCount, getCallCounts, adjustCallCount };
