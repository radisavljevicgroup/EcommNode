const { Router } = require("express");
const crypto = require("crypto");
const ga4 = require("../lib/ga4");
const {
  getConnections: getGa4Connections,
  getConnection,
  addConnection,
  removeConnection,
} = require("../lib/ga4Store");
const { getConnections: getWooConnections } = require("../lib/store");

const router = Router();

function toPublic(connection) {
  const target = getWooConnections().find((c) => c.id === connection.targetConnectionId);
  return {
    id: connection.id,
    label: connection.label,
    propertyId: connection.propertyId,
    serviceAccountEmail: connection.serviceAccountEmail,
    targetConnectionId: connection.targetConnectionId,
    targetSiteUrl: target?.siteUrl || null,
  };
}

function connectionError(err) {
  if (err.status === 401 || err.status === 403) {
    return (
      "Service account nema pristup ovom GA4 property-ju. Dodaj njegov email kao Viewer-a u Admin > Property Access Management. " +
      `(Google poruka: ${err.message})`
    );
  }
  return err.message || "Ne mogu da se povežem na Google Analytics 4.";
}

router.post("/ga4/connect", async (req, res) => {
  const { label, propertyId, serviceAccountJson, targetConnectionId } = req.body || {};

  if (!propertyId || !serviceAccountJson || !targetConnectionId) {
    return res.status(400).json({
      error: "Nedostaju podaci: Property ID, service account JSON i ciljna prodavnica su obavezni.",
    });
  }

  if (!getWooConnections().some((c) => c.id === targetConnectionId)) {
    return res.status(400).json({ error: "Izabrana ciljna prodavnica ne postoji." });
  }

  let serviceAccountEmail;
  try {
    serviceAccountEmail = await ga4.testConnection({ propertyId, serviceAccountJson });
  } catch (err) {
    return res.status(400).json({ error: connectionError(err) });
  }

  const connection = {
    id: crypto.randomUUID(),
    label: label || `GA4 — ${propertyId}`,
    propertyId,
    serviceAccountJson,
    serviceAccountEmail,
    targetConnectionId,
  };

  addConnection(connection);
  res.json({ connected: true, connection: toPublic(connection) });
});

router.post("/ga4/disconnect", (req, res) => {
  const { id } = req.body || {};
  const connections = removeConnection(id);
  res.json({ connections: connections.map(toPublic) });
});

router.get("/ga4/status", (req, res) => {
  res.json({ connections: getGa4Connections().map(toPublic) });
});

router.get("/ga4/performance", async (req, res) => {
  const { id, from, to } = req.query;
  const connection = getConnection(id);
  if (!connection) return res.status(404).json({ error: "Integracija nije pronađena." });

  try {
    const data = await ga4.getPerformance(connection, { from, to });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: connectionError(err) });
  }
});

module.exports = router;
