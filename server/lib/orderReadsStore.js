const { createJsonFile } = require("./jsonFile");

// "Nepročitano" state behind Orders.jsx's blue bar, like an e-mail inbox —
// per user account, like a personal mailbox: a colleague opening an order
// reads it only for themselves, everyone else still sees the blue bar
// until they open it too. Every order a user hasn't opened yet is unread,
// old ones included. Keyed by userId, then connectionId+orderId (order ids
// aren't unique across connected stores, same as orderCallsStore.js);
// true = read, false = marked unread again.
const file = createJsonFile("order-reads.json", { users: {} });
let data = file.read();
// Earlier this was one shared state per company ({ state }) — that can't
// be told apart per user, so every account simply starts fresh.
if (!data.users) data = { users: {} };

function keyFor(connectionId, orderId) {
  return `${connectionId}:${orderId}`;
}

function isOrderUnread(userId, connectionId, orderId) {
  return data.users[userId]?.[keyFor(connectionId, orderId)] !== true;
}

function setOrderRead(userId, connectionId, orderId, read) {
  const userState = { ...(data.users[userId] || {}), [keyFor(connectionId, orderId)]: Boolean(read) };
  data = { ...data, users: { ...data.users, [userId]: userState } };
  file.write(data);
}

// Adds each order's unread flag for this user to an orders-list response.
function withReadState(result, userId) {
  return {
    ...result,
    orders: (result.orders || []).map((o) => ({
      ...o,
      unread: isOrderUnread(userId, o.connectionId, o.id),
    })),
  };
}

module.exports = { setOrderRead, withReadState };
