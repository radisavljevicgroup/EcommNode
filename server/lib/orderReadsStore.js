const { createJsonFile } = require("./jsonFile");

// "Nepročitano" state behind Orders.jsx's blue bar, like an e-mail inbox —
// shared per company (a shared mailbox, not per user): once anyone opens an
// order it's read for the whole team, and anyone can mark it unread again.
// Every order nobody has opened yet is unread, old ones included. Keyed by
// connectionId+orderId (order ids aren't unique across connected stores,
// same as orderCallsStore.js); true = read, false = marked unread again.
const file = createJsonFile("order-reads.json", { state: {} });
let data = file.read();

function keyFor(connectionId, orderId) {
  return `${connectionId}:${orderId}`;
}

function isOrderUnread(connectionId, orderId) {
  return data.state[keyFor(connectionId, orderId)] !== true;
}

function setOrderRead(connectionId, orderId, read) {
  data = { ...data, state: { ...data.state, [keyFor(connectionId, orderId)]: Boolean(read) } };
  file.write(data);
}

module.exports = { isOrderUnread, setOrderRead };
