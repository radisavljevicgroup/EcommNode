const { Router } = require("express");
const crypto = require("crypto");
const meta = require("../lib/meta");
const {
  getConnections: getMetaConnections,
  getConnection,
  addConnection,
  removeConnection,
  updateConnection,
} = require("../lib/metaStore");
const { getConnections: getWooConnections } = require("../lib/store");
const { getOrdersForConnections } = require("../lib/ordersCache");
const analytics = require("../lib/analytics");

const router = Router();

// accessToken never leaves this function — the frontend only ever sees
// adAccountId/accountName, the same way GA4's serviceAccountJson is
// stripped before a connection is sent back to the client.
function toPublic(connection, company) {
  const allWoo = getWooConnections(company);
  // Older connections saved before multi-store support only have a single
  // targetConnectionId — read either shape so existing saved connections
  // keep working without a migration step.
  const ids = connection.targetConnectionIds || (connection.targetConnectionId ? [connection.targetConnectionId] : []);
  const targets = ids.map((id) => allWoo.find((c) => c.id === id)).filter(Boolean);
  return {
    id: connection.id,
    label: connection.label,
    adAccountId: connection.adAccountId,
    accountName: connection.accountName,
    currency: connection.currency || null,
    targetConnectionIds: ids,
    targetSiteUrls: targets.map((t) => t.siteUrl),
  };
}

function connectionError(err) {
  if (err.status === 401 || err.status === 403) {
    return (
      "Access token je nevažeći, istekao je, ili nema dozvolu ads_read za ovaj oglasni nalog. " +
      "Generiši novi token u Meta Business Suite (Business Settings → System Users) ili proveri dozvole. " +
      `(Meta poruka: ${err.message})`
    );
  }
  return err.message || "Ne mogu da se povežem na Meta Ads.";
}

router.post("/meta/connect", async (req, res) => {
  const { label, accessToken, adAccountId, targetConnectionIds } = req.body || {};

  if (!accessToken || !adAccountId || !Array.isArray(targetConnectionIds) || !targetConnectionIds.length) {
    return res.status(400).json({
      error: "Nedostaju podaci: Access token, Ad Account ID i bar jedna ciljna prodavnica su obavezni.",
    });
  }

  const wooIds = new Set(getWooConnections(req.company).map((c) => c.id));
  if (!targetConnectionIds.every((id) => wooIds.has(id))) {
    return res.status(400).json({ error: "Neka od izabranih ciljnih prodavnica ne postoji." });
  }

  let accountName, currency;
  try {
    ({ name: accountName, currency } = await meta.testConnection({ accessToken, adAccountId }));
  } catch (err) {
    return res.status(400).json({ error: connectionError(err) });
  }

  const connection = {
    id: crypto.randomUUID(),
    label: label || `Meta Ads — ${accountName || adAccountId}`,
    accessToken,
    adAccountId,
    accountName,
    currency,
    targetConnectionIds,
    company: req.company,
  };

  addConnection(connection);
  res.json({ connected: true, connection: toPublic(connection, req.company) });
});

router.post("/meta/update-stores", (req, res) => {
  const { id, targetConnectionIds } = req.body || {};
  const connection = getConnection(id, req.company);
  if (!connection) return res.status(404).json({ error: "Integracija nije pronađena." });

  if (!Array.isArray(targetConnectionIds) || !targetConnectionIds.length) {
    return res.status(400).json({ error: "Izaberi bar jednu prodavnicu." });
  }
  const wooIds = new Set(getWooConnections(req.company).map((c) => c.id));
  if (!targetConnectionIds.every((wid) => wooIds.has(wid))) {
    return res.status(400).json({ error: "Neka od izabranih ciljnih prodavnica ne postoji." });
  }

  const updated = updateConnection(id, req.company, { targetConnectionIds });
  res.json({ connection: toPublic(updated, req.company) });
});

router.post("/meta/disconnect", (req, res) => {
  const { id } = req.body || {};
  const connections = removeConnection(id, req.company);
  res.json({ connections: connections.map((c) => toPublic(c, req.company)) });
});

router.get("/meta/status", (req, res) => {
  res.json({ connections: getMetaConnections(req.company).map((c) => toPublic(c, req.company)) });
});

router.get("/meta/performance", async (req, res) => {
  const { id, from, to } = req.query;
  let connection = getConnection(id, req.company);
  if (!connection) return res.status(404).json({ error: "Integracija nije pronađena." });

  try {
    // Connections saved before currency tracking was added don't have it
    // cached — backfill it here instead of forcing a reconnect.
    if (!connection.currency) {
      const { currency } = await meta.testConnection({
        accessToken: connection.accessToken,
        adAccountId: connection.adAccountId,
      });
      if (currency) connection = updateConnection(id, req.company, { currency });
    }
    const data = await meta.getPerformance(connection, { from, to });

    // CAC (and revenue's real currency, below) for this connection alone —
    // scoped to just the stores it targets, same date range as the spend
    // query above.
    const wooIds = new Set(connection.targetConnectionIds || []);
    const targetWoo = getWooConnections(req.company).filter((c) => wooIds.has(c.id));
    let revenueCurrency = null;
    if (targetWoo.length) {
      const orders = await getOrdersForConnections(targetWoo);
      const periodOrders = analytics.filterByRange(orders, from, to);
      const newCustomers = analytics.newCustomerCount(periodOrders, orders, from, to);
      data.totals.newCustomers = newCustomers;
      data.totals.cac = newCustomers > 0 ? data.totals.spend / newCustomers : null;
      revenueCurrency = orders[0]?.currency || null;
    } else {
      data.totals.newCustomers = null;
      data.totals.cac = null;
    }

    // Meta's purchase-value pixel data reports in the store's currency
    // (RSD), not the ad account's billing currency (EUR) — profit can
    // only be computed (revenue - spend) when those actually match,
    // otherwise it'd silently subtract one currency from another.
    data.allAds = (data.allAds || []).map((ad) => ({
      ...ad,
      revenueCurrency,
      profit: revenueCurrency && revenueCurrency === data.currency ? ad.revenue - ad.total : null,
    }));

    res.json(data);
  } catch (err) {
    res.status(400).json({ error: connectionError(err) });
  }
});

module.exports = router;
