const { createJsonFile } = require("./jsonFile");

// "Nepročitano" state behind Orders.jsx's blue bar, like an e-mail inbox —
// shared per company (a shared mailbox, not per user): once anyone opens an
// order it's read for the whole team, and anyone can mark it unread again.
// Explicit state is keyed by connectionId+orderId (order ids aren't unique
// across connected stores, same as orderCallsStore.js). Orders with no
// explicit state are unread only if they were created after the company
// first loaded orders with this feature (since) — otherwise switching it on
// would flag the whole order history as new.
const file = createJsonFile("order-reads.json", { since: {}, state: {} });
let data = file.read();

function keyFor(connectionId, orderId) {
  return `${connectionId}:${orderId}`;
}

function sinceFor(company) {
  if (!data.since[company]) {
    data = { ...data, since: { ...data.since, [company]: new Date().toISOString() } };
    file.write(data);
  }
  return data.since[company];
}

function isOrderUnread(company, connectionId, order) {
  const explicit = data.state[keyFor(connectionId, order.id)];
  if (explicit !== undefined) return !explicit;
  return new Date(order.dateCreated) >= new Date(sinceFor(company));
}

function setOrderRead(connectionId, orderId, read) {
  data = { ...data, state: { ...data.state, [keyFor(connectionId, orderId)]: Boolean(read) } };
  file.write(data);
}

module.exports = { isOrderUnread, setOrderRead };
