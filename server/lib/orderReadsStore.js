const { createJsonFile } = require("./jsonFile");

// "Nepročitano" state behind Orders.jsx's blue bar, like an e-mail inbox —
// per user account, like a personal mailbox: a colleague opening an order
// reads it only for themselves, everyone else still sees the blue bar
// until they open it too. Keyed by userId, then connectionId+orderId
// (order ids aren't unique across connected stores, same as
// orderCallsStore.js); true = read, false = marked unread again.
//
// Read from disk on every call, never cached in memory: the host can run
// more than one Node process for the API at once, and a per-process copy
// meant an order opened on one process came back unread (and got
// overwritten) as soon as a refresh landed on another.
const file = createJsonFile("order-reads.json", { users: {} });

function keyFor(connectionId, orderId) {
  return `${connectionId}:${orderId}`;
}

function load() {
  const data = file.read() || {};
  return { ...data, users: data.users || {} };
}

// data.state is the old shared-per-company state from before read status
// went per user — kept (never written again) as the starting point for
// every account, so switching to per-user didn't make orders someone had
// already opened unread again.
function isRead(data, userId, key) {
  const own = data.users[userId]?.[key];
  if (own !== undefined) return own === true;
  return data.state?.[key] === true;
}

function setOrderRead(userId, connectionId, orderId, read) {
  const data = load();
  const userState = { ...(data.users[userId] || {}), [keyFor(connectionId, orderId)]: Boolean(read) };
  file.write({ ...data, users: { ...data.users, [userId]: userState } });
}

// Adds each order's unread flag for this user to an orders-list response.
function withReadState(result, userId) {
  const data = load();
  return {
    ...result,
    orders: (result.orders || []).map((o) => ({
      ...o,
      unread: !isRead(data, userId, keyFor(o.connectionId, o.id)),
    })),
  };
}

module.exports = { setOrderRead, withReadState };
