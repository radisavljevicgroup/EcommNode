const { Router } = require("express");
const crypto = require("crypto");
const { createWooClient } = require("../lib/woocommerce");
const { getConnections, addConnection, removeConnection } = require("../lib/store");

const router = Router();

router.post("/connect", async (req, res) => {
  const { siteUrl, consumerKey, consumerSecret } = req.body || {};

  if (!siteUrl || !consumerKey || !consumerSecret) {
    return res.status(400).json({
      error: "Nedostaju podaci: URL sajta, Consumer Key i Consumer Secret su obavezni.",
    });
  }

  let normalizedUrl;
  try {
    normalizedUrl = new URL(siteUrl).toString();
  } catch {
    return res.status(400).json({ error: "URL sajta nije validan." });
  }

  if (getConnections().some((c) => c.siteUrl === normalizedUrl)) {
    return res.status(400).json({ error: "Ova prodavnica je već povezana." });
  }

  const client = createWooClient({
    siteUrl: normalizedUrl,
    consumerKey,
    consumerSecret,
  });

  try {
    // Test the connection by fetching a single order.
    await client.get("orders", { per_page: 1 });
  } catch (err) {
    const status = err?.response?.status;
    let message = "Ne mogu da se povežem na WooCommerce. Proveri URL i pristupne podatke.";
    if (status === 401) {
      message = "Consumer Key ili Consumer Secret nisu ispravni.";
    } else if (status === 404) {
      message = "WooCommerce REST API nije pronađen na datom URL-u.";
    } else if (!err?.response) {
      message = "Sajt nije dostupan. Proveri da li je URL tačan.";
    }
    return res.status(400).json({ error: message });
  }

  const connection = {
    id: crypto.randomUUID(),
    siteUrl: normalizedUrl,
    consumerKey,
    consumerSecret,
  };

  addConnection(connection);

  res.json({
    connected: true,
    connection: { id: connection.id, siteUrl: connection.siteUrl },
  });
});

router.post("/disconnect", (req, res) => {
  const { id } = req.body || {};
  const connections = removeConnection(id);
  res.json({ connections: connections.map(toPublic) });
});

router.get("/status", (req, res) => {
  res.json({ connections: getConnections().map(toPublic) });
});

function toPublic(connection) {
  return { id: connection.id, siteUrl: connection.siteUrl };
}

module.exports = router;
