const { Router } = require("express");
const crypto = require("crypto");
const gsc = require("../lib/gsc");
const { buildAuthUrl, stashState, takePending } = require("../lib/googleOAuthClient");
const {
  getConnections: getGscConnections,
  getConnection,
  addConnection,
  removeConnection,
} = require("../lib/gscStore");
const { getConnections: getWooConnections } = require("../lib/store");

const router = Router();

const GSC_OAUTH_SCOPE = "openid email https://www.googleapis.com/auth/webmasters.readonly";

function toPublic(connection, company) {
  const target = getWooConnections(company).find((c) => c.id === connection.targetConnectionId);
  return {
    id: connection.id,
    label: connection.label,
    siteUrl: connection.siteUrl,
    // Older connections made via the retired manual service-account-JSON
    // form have serviceAccountEmail instead — both are "who this
    // connection reads Search Console as", just from two different connect
    // methods.
    connectedAs: connection.googleAccountEmail || connection.serviceAccountEmail || null,
    targetConnectionId: connection.targetConnectionId,
    targetSiteUrl: target?.siteUrl || null,
  };
}

function connectionError(err, connection) {
  if (err.status === 401 || err.status === 403) {
    if (connection?.refreshToken) {
      return (
        "Google nalog kojim je ovo povezano nema (više) pristup ovom sajtu u Search Console-u, " +
        "ili je pristup opozvan. Ukloni integraciju i ponovo je poveži nalogom koji ima pristup " +
        `sajtu u Settings > Users and permissions. (Google poruka: ${err.message})`
      );
    }
    return (
      "Service account nema pristup ovom sajtu u Search Console-u. Dodaj njegov email kao korisnika u Settings > Users and permissions. " +
      `(Google poruka: ${err.message})`
    );
  }
  if (err.status === 404) {
    return (
      "Sajt nije pronađen u Search Console-u za ovaj nalog — Search Console API vraća 404 i kad sajt postoji ali nalog nema pristup njemu (iz bezbednosnih razloga ne otkriva razliku). Proveri da li je baš taj nalog dodat kao korisnik BAŠ za ovaj sajt u Settings > Users and permissions. " +
      `(Google poruka: ${err.message})`
    );
  }
  return err.message || "Ne mogu da se povežem na Google Search Console.";
}

// Step 1 of "Poveži se sa Google nalogom" — mints a one-time `state` bound
// to this company (checked again in /gsc/connect below) and hands back the
// URL the frontend opens in a popup; routes/googleOAuth.js's shared
// callback does the actual code exchange once Google redirects back.
router.get("/gsc/oauth/start", (req, res) => {
  try {
    const appOrigin = req.headers.origin || process.env.CLIENT_ORIGIN || null;
    const state = stashState({ company: req.company, product: "gsc", appOrigin });
    res.json({ authUrl: buildAuthUrl(GSC_OAUTH_SCOPE, state) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/gsc/connect", async (req, res) => {
  const { label, pendingId, siteUrl, targetConnectionId } = req.body || {};

  if (!pendingId || !siteUrl || !targetConnectionId) {
    return res.status(400).json({
      error: "Nedostaju podaci: Google nalog, sajt i ciljna prodavnica su obavezni.",
    });
  }

  if (!getWooConnections(req.company).some((c) => c.id === targetConnectionId)) {
    return res.status(400).json({ error: "Izabrana ciljna prodavnica ne postoji." });
  }

  const entry = takePending(pendingId);
  if (!entry || entry.company !== req.company || entry.product !== "gsc") {
    return res.status(400).json({
      error: "Sesija povezivanja sa Google nalogom je istekla — probaj ponovo.",
    });
  }

  const site = (entry.items || []).find((s) => s.siteUrl === siteUrl);
  if (!site) {
    return res.status(400).json({ error: "Izabrani sajt nije pronađen u listi." });
  }

  const connection = {
    id: crypto.randomUUID(),
    label: label || `GSC — ${siteUrl}`,
    siteUrl,
    refreshToken: entry.refreshToken,
    googleAccountEmail: entry.email || null,
    targetConnectionId,
    company: req.company,
  };

  try {
    await gsc.testConnection(connection);
  } catch (err) {
    return res.status(400).json({ error: connectionError(err, connection) });
  }

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
    res.status(400).json({ error: connectionError(err, connection) });
  }
});

module.exports = router;
