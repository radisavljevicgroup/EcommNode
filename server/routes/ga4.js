const { Router } = require("express");
const crypto = require("crypto");
const ga4 = require("../lib/ga4");
const { buildAuthUrl, stashState, takePending } = require("../lib/googleOAuthClient");
const {
  getConnections: getGa4Connections,
  getConnection,
  addConnection,
  removeConnection,
} = require("../lib/ga4Store");
const { getConnections: getWooConnections } = require("../lib/store");

const router = Router();

const GA4_OAUTH_SCOPE = "openid email https://www.googleapis.com/auth/analytics.readonly";

function toPublic(connection, company) {
  const target = getWooConnections(company).find((c) => c.id === connection.targetConnectionId);
  return {
    id: connection.id,
    label: connection.label,
    propertyId: connection.propertyId,
    // Older connections made via the retired manual service-account-JSON
    // form have serviceAccountEmail instead — both are "who this
    // connection reads GA4 as", just from two different connect methods.
    connectedAs: connection.googleAccountEmail || connection.serviceAccountEmail || null,
    targetConnectionId: connection.targetConnectionId,
    targetSiteUrl: target?.siteUrl || null,
  };
}

function connectionError(err, connection) {
  if (err.status === 401 || err.status === 403) {
    if (connection?.refreshToken) {
      return (
        "Google nalog kojim je ovo povezano nema (više) pristup ovom GA4 property-ju, ili je " +
        "pristup opozvan. Ukloni integraciju i ponovo je poveži nalogom koji ima pristup " +
        `property-ju u Admin > Property Access Management. (Google poruka: ${err.message})`
      );
    }
    return (
      "Service account nema pristup ovom GA4 property-ju. Dodaj njegov email kao Viewer-a u Admin > Property Access Management. " +
      `(Google poruka: ${err.message})`
    );
  }
  return err.message || "Ne mogu da se povežem na Google Analytics 4.";
}

// Step 1 of "Poveži se sa Google nalogom" — mints a one-time `state` bound
// to this company (checked again in /ga4/connect below) and hands back the
// URL the frontend opens in a popup; routes/googleOAuth.js's shared
// callback does the actual code exchange once Google redirects back.
router.get("/ga4/oauth/start", (req, res) => {
  try {
    const appOrigin = req.headers.origin || process.env.CLIENT_ORIGIN || null;
    const state = stashState({ company: req.company, product: "ga4", appOrigin });
    res.json({ authUrl: buildAuthUrl(GA4_OAUTH_SCOPE, state) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/ga4/connect", async (req, res) => {
  const { label, pendingId, propertyId, targetConnectionId } = req.body || {};

  if (!pendingId || !propertyId || !targetConnectionId) {
    return res.status(400).json({
      error: "Nedostaju podaci: Google nalog, GA4 property i ciljna prodavnica su obavezni.",
    });
  }

  if (!getWooConnections(req.company).some((c) => c.id === targetConnectionId)) {
    return res.status(400).json({ error: "Izabrana ciljna prodavnica ne postoji." });
  }

  const entry = takePending(pendingId);
  if (!entry || entry.company !== req.company || entry.product !== "ga4") {
    return res.status(400).json({
      error: "Sesija povezivanja sa Google nalogom je istekla — probaj ponovo.",
    });
  }

  const property = (entry.items || []).find((p) => p.propertyId === propertyId);
  if (!property) {
    return res.status(400).json({ error: "Izabrani GA4 property nije pronađen u listi." });
  }

  const connection = {
    id: crypto.randomUUID(),
    label: label || `GA4 — ${property.displayName || propertyId}`,
    propertyId,
    refreshToken: entry.refreshToken,
    googleAccountEmail: entry.email || null,
    targetConnectionId,
    company: req.company,
  };

  try {
    await ga4.testConnection(connection);
  } catch (err) {
    return res.status(400).json({ error: connectionError(err, connection) });
  }

  addConnection(connection);
  res.json({ connected: true, connection: toPublic(connection, req.company) });
});

router.post("/ga4/disconnect", (req, res) => {
  const { id } = req.body || {};
  const connections = removeConnection(id, req.company);
  res.json({ connections: connections.map((c) => toPublic(c, req.company)) });
});

router.get("/ga4/status", (req, res) => {
  res.json({ connections: getGa4Connections(req.company).map((c) => toPublic(c, req.company)) });
});

router.get("/ga4/performance", async (req, res) => {
  const { id, from, to } = req.query;
  const connection = getConnection(id, req.company);
  if (!connection) return res.status(404).json({ error: "Integracija nije pronađena." });

  try {
    const data = await ga4.getPerformance(connection, { from, to });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: connectionError(err, connection) });
  }
});

module.exports = router;
