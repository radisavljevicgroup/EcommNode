const { Router } = require("express");
const crypto = require("crypto");
const gsc = require("../lib/gsc");
const {
  getConnections: getGscConnections,
  getConnection,
  addConnection,
  removeConnection,
} = require("../lib/gscStore");
const { getConnections: getWooConnections } = require("../lib/store");

const router = Router();

function toPublic(connection, company) {
  const target = getWooConnections(company).find((c) => c.id === connection.targetConnectionId);
  return {
    id: connection.id,
    label: connection.label,
    siteUrl: connection.siteUrl,
    serviceAccountEmail: connection.serviceAccountEmail,
    targetConnectionId: connection.targetConnectionId,
    targetSiteUrl: target?.siteUrl || null,
  };
}

function connectionError(err) {
  if (err.status === 401 || err.status === 403) {
    return (
      "Service account nema pristup ovom sajtu u Search Console-u. Dodaj njegov email kao korisnika u Settings > Users and permissions. " +
      `(Google poruka: ${err.message})`
    );
  }
  if (err.status === 404) {
    return (
      "Sajt nije pronađen u Search Console-u za ovaj service account — Search Console API vraća 404 i kad sajt postoji ali service account nema pristup njemu (iz bezbednosnih razloga ne otkriva razliku). Proveri da li je baš OVAJ email dodat kao korisnik BAŠ za ovaj sajt u Settings > Users and permissions, i da li je URL tačno onakav kakav je verifikovan (npr. https://sajt.rs/ ili sc-domain:sajt.rs). " +
      `(Google poruka: ${err.message})`
    );
  }
  return err.message || "Ne mogu da se povežem na Google Search Console.";
}

router.post("/gsc/connect", async (req, res) => {
  const { label, siteUrl, serviceAccountJson, targetConnectionId } = req.body || {};

  if (!siteUrl || !serviceAccountJson || !targetConnectionId) {
    return res.status(400).json({
      error: "Nedostaju podaci: URL sajta, service account JSON i ciljna prodavnica su obavezni.",
    });
  }

  if (!getWooConnections(req.company).some((c) => c.id === targetConnectionId)) {
    return res.status(400).json({ error: "Izabrana ciljna prodavnica ne postoji." });
  }

  let serviceAccountEmail;
  try {
    serviceAccountEmail = await gsc.testConnection({ siteUrl, serviceAccountJson });
  } catch (err) {
    return res.status(400).json({ error: connectionError(err) });
  }

  const connection = {
    id: crypto.randomUUID(),
    label: label || `GSC — ${siteUrl}`,
    siteUrl,
    serviceAccountJson,
    serviceAccountEmail,
    targetConnectionId,
    company: req.company,
  };

  addConnection(connection);
  res.json({ connected: true, connection: toPublic(connection, req.company) });
});

router.post("/gsc/disconnect", (req, res) => {
  const { id } = req.body || {};
  const connections = removeConnection(id, req.company);
  res.json({ connections: connections.map((c) => toPublic(c, req.company)) });
});

router.get("/gsc/status", (req, res) => {
  res.json({ connections: getGscConnections(req.company).map((c) => toPublic(c, req.company)) });
});

router.get("/gsc/performance", async (req, res) => {
  const { id, from, to } = req.query;
  const connection = getConnection(id, req.company);
  if (!connection) return res.status(404).json({ error: "Integracija nije pronađena." });

  try {
    const data = await gsc.getPerformance(connection, { from, to });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: connectionError(err) });
  }
});

module.exports = router;
