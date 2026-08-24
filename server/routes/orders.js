const { Router } = require("express");
const { createWooClient } = require("../lib/woocommerce");
const { getConnections, removeConnection } = require("../lib/store");
const { getStaleOrders } = require("../lib/ordersCache");
const { mapOrder } = require("../lib/mapOrder");

const router = Router();

const ALLOWED_PER_PAGE = [10, 20, 30, 50];
const MAX_WOO_PER_PAGE = 100;

// undefined (param omitted) => null => no status filter (all statuses).
// "" (param present but empty, i.e. every checkbox unchecked) => [] => caller
// must treat this as "match nothing" rather than falling back to "all".
function parseStatus(req) {
  if (req.query.status === undefined) return null;
  return req.query.status.split(",").filter(Boolean);
}

// Pulls the top `needed` orders (WooCommerce's default sort is date desc)
// from a single connection, paging internally in chunks of 100.
async function fetchTopOrders(connection, needed, search, status) {
  let collected = [];
  let page = 1;
  let total = 0;

  while (collected.length < needed) {
    const params = { page, per_page: MAX_WOO_PER_PAGE };
    if (search) params.search = search;
    if (status) params.status = status.join(",");
    const response = await createWooClient(connection).get("orders", params);
    total = Number(response.headers?.["x-wp-total"] || response.data.length);
    const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);

    collected = collected.concat(response.data);
    if (page >= totalPages || response.data.length === 0) break;
    page += 1;
  }

  return { data: collected.slice(0, needed), total };
}

router.get("/orders", async (req, res) => {
  const connections = getConnections();
  if (connections.length === 0) {
    return res.status(401).json({ error: "Nisi povezan ni sa jednom WooCommerce prodavnicom." });
  }

  const { connectionId, search, stale } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = ALLOWED_PER_PAGE.includes(Number(req.query.perPage))
    ? Number(req.query.perPage)
    : 10;
  const status = parseStatus(req);

  // Every status checkbox unchecked — nothing can match, no need to call
  // WooCommerce at all.
  if (status !== null && status.length === 0) {
    return res.json({ orders: [], pagination: { page, perPage, total: 0, totalPages: 1 } });
  }

  let targets;
  if (connectionId && connectionId !== "all") {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) {
      return res.status(404).json({ error: "Integracija nije pronađena." });
    }
    targets = [connection];
  } else {
    targets = connections;
  }

  // Stale-orders view reads from the local analytics cache (needs full
  // history to find old un-completed orders) instead of paginating the
  // live WooCommerce API.
  if (stale === "true" || stale === "1") {
    try {
      const result = await getStaleOrders(targets, { page, perPage });
      return res.json(result);
    } catch {
      return res.status(400).json({ error: "Ne mogu da učitam zastarele porudžbine." });
    }
  }

  try {
    const tagSource = targets.length > 1;

    if (targets.length === 1) {
      const params = { page, per_page: perPage };
      if (search) params.search = search;
      if (status) params.status = status.join(",");
      const response = await createWooClient(targets[0]).get("orders", params);
      const total = Number(response.headers?.["x-wp-total"] || response.data.length);
      const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);

      return res.json({
        orders: response.data.map((o) => mapOrder(o, null)),
        pagination: { page, perPage, total, totalPages },
      });
    }

    // Merging multiple independent WooCommerce sources: each source only
    // knows its own pagination, so to hand back exactly `perPage` items for
    // the requested global page we pull each source's top (page * perPage)
    // orders (sorted date desc), merge-sort them, then slice the window.
    const needed = page * perPage;
    const results = await Promise.all(
      targets.map(async (connection) => {
        const { data, total } = await fetchTopOrders(connection, needed, search, status);
        return {
          orders: data.map((o) => mapOrder(o, tagSource ? connection.siteUrl : null)),
          total,
        };
      })
    );

    const merged = results
      .flatMap((r) => r.orders)
      .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));

    const start = (page - 1) * perPage;
    const total = results.reduce((sum, r) => sum + r.total, 0);

    res.json({
      orders: merged.slice(start, start + perPage),
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    });
  } catch (err) {
    if (err?.response?.status === 401 && targets.length === 1) {
      removeConnection(targets[0].id);
      return res.status(401).json({ error: "Pristupni podaci više ne važe, poveži se ponovo." });
    }
    res.status(400).json({ error: "Ne mogu da učitam porudžbine sa WooCommerce-a." });
  }
});

router.get("/orders/stale-count", async (req, res) => {
  const connections = getConnections();
  try {
    const result = await getStaleOrders(connections, { page: 1, perPage: 1 });
    res.json({ count: result.pagination.total });
  } catch {
    res.status(400).json({ error: "Ne mogu da izračunam broj zastarelih porudžbina." });
  }
});

module.exports = router;
