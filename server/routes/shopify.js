const { Router } = require("express");
const crypto = require("crypto");
const { normalizeShopDomain, testShopifyConnection } = require("../lib/shopify");
const { getConnections, addConnection, removeConnection } = require("../lib/shopifyStore");

const router = Router();

router.post("/shopify/connect", async (req, res) => {
  const { shopDomain, accessToken } = req.body || {};

  if (!shopDomain || !accessToken) {
    return res.status(400).json({
      error: "Nedostaju podaci: domen prodavnice i Admin API Access Token su obavezni.",
    });
  }

  const normalizedDomain = normalizeShopDomain(shopDomain);
  if (!normalizedDomain) {
    return res.status(400).json({ error: "Domen prodavnice nije validan." });
  }

  if (getConnections(req.company).some((c) => c.shopDomain === normalizedDomain)) {
    return res.status(400).json({ error: "Ova prodavnica je već povezana." });
  }

  const candidate = { shopDomain: normalizedDomain, accessToken };

  let shop;
  try {
    shop = await testShopifyConnection(candidate);
  } catch (err) {
    let message = "Ne mogu da se povežem na Shopify. Proveri domen i pristupni token.";
    if (err.status === 401 || err.status === 403) {
      message = "Admin API Access Token nije ispravan ili nema dovoljno dozvola.";
    } else if (err.status === 404) {
      message = "Shopify prodavnica nije pronađena na datom domenu.";
    } else if (!err.status) {
      message = "Prodavnica nije dostupna. Proveri da li je domen tačan.";
    }
    return res.status(400).json({ error: message });
  }

  const connection = {
    id: crypto.randomUUID(),
    siteUrl: `https://${normalizedDomain}`,
    shopDomain: normalizedDomain,
    shopName: shop?.name || normalizedDomain,
    accessToken,
    platform: "shopify",
    company: req.company,
  };

  addConnection(connection);

  res.json({
    connected: true,
    connection: toPublic(connection),
  });
});

router.post("/shopify/disconnect", (req, res) => {
  const { id } = req.body || {};
  const connections = removeConnection(id, req.company);
  res.json({ connections: connections.map(toPublic) });
});

router.get("/shopify/status", (req, res) => {
  res.json({ connections: getConnections(req.company).map(toPublic) });
});

function toPublic(connection) {
  return {
    id: connection.id,
    siteUrl: connection.siteUrl,
    shopDomain: connection.shopDomain,
    shopName: connection.shopName,
    platform: "shopify",
  };
}

module.exports = router;
