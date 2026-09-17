const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectRouter = require("./routes/connect");
const shopifyRouter = require("./routes/shopify");
const ordersRouter = require("./routes/orders");
const analyticsRouter = require("./routes/analytics");
const settingsRouter = require("./routes/settings");
const ga4Router = require("./routes/ga4");
const gscRouter = require("./routes/gsc");
const googleOAuthRouter = require("./routes/googleOAuth");
const metaRouter = require("./routes/meta");
const workersRouter = require("./routes/workers");
const inboxRouter = require("./routes/inbox");
const dashboardRouter = require("./routes/dashboard");
const calendarRouter = require("./routes/calendar");
const firmaRouter = require("./routes/firma");
const personalizationRouter = require("./routes/personalization");
const { requireAuth, requirePremiumModule } = require("./lib/auth");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Vite dev server can pick a different port if the default one is busy
// (5173, 5174, ...), so any localhost origin is always allowed regardless
// of CLIENT_ORIGIN — otherwise setting CLIENT_ORIGIN to lock production
// down to the real domain would also lock out every future local dev
// session against this same (production) API.
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, server-to-server, same-origin) — nothing
      // for CORS to enforce.
      if (!origin) return callback(null, true);
      if (LOCALHOST_ORIGIN.test(origin)) return callback(null, true);
      if (CLIENT_ORIGIN && origin === CLIENT_ORIGIN) return callback(null, true);
      if (!CLIENT_ORIGIN) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  })
);
// Captures the exact request bytes alongside the parsed body — the Meta
// inbox webhook (routes/inbox.js) needs the raw payload to verify
// X-Hub-Signature-256, since re-serializing the parsed JSON isn't
// guaranteed to byte-match what Meta actually signed. Raised from 10mb to
// 25mb for routes/personalization.js, which accepts up to
// MAX_FILES_PER_UPLOAD base64-encoded files (same data-URL-in-JSON pattern
// as routes/workers.js's avatar upload) in a single request.
app.use(express.json({ limit: "25mb", verify: (req, res, buf) => { req.rawBody = buf; } }));

// requireAuth verifies the caller's Supabase session and attaches
// req.company/req.userId — every route below reads/writes data scoped to
// that company (see lib/auth.js). Three routers are deliberately excluded
// AND mounted first, before any requireAuth-gated app.use("/api", ...)
// call: workersRouter does its own, stricter check (requireManager,
// role-gated); inboxRouter mixes public webhook receivers with
// merchant-facing endpoints in one file, applying requireAuth itself per-
// route; googleOAuthRouter is Google's own redirect back from the consent
// screen, which can't carry our Authorization header at all.
//
// Mounting order matters here in a way that's easy to get backwards:
// Express matches app.use("/api", ...) layers by PATH PREFIX only, not by
// which router will actually end up handling the request — so a plain
// requireAuth mounted at "/api" (e.g. connectRouter's, below) intercepts
// and 401s EVERY /api/* request that reaches it first, including ones
// meant for a later, unauthenticated router, before that router ever gets
// a chance to say "not my route". These three have to come before every
// requireAuth-gated mount for that reason, not just before some of them.
app.use("/api", workersRouter);
app.use("/api", inboxRouter);
app.use("/api", googleOAuthRouter);
app.use("/api", requireAuth, connectRouter);
app.use("/api", requireAuth, shopifyRouter);
app.use("/api", requireAuth, ordersRouter);
app.use("/api", requireAuth, analyticsRouter);
app.use("/api", requireAuth, settingsRouter);
app.use("/api", requireAuth, ga4Router);
app.use("/api", requireAuth, gscRouter);
app.use("/api", requireAuth, metaRouter);
app.use("/api", requireAuth, dashboardRouter);
app.use("/api", requireAuth, calendarRouter);
app.use("/api", requireAuth, firmaRouter);
app.use("/api", requireAuth, personalizationRouter);

// Premium integrations (e.g. Eurocom International) live outside this
// open-source repo — each one is a self-contained router at
// server/premium/<name>/index.js. That folder is gitignored, so a public
// checkout simply has none of them and this loop mounts nothing.
const premiumDir = path.join(__dirname, "premium");
if (fs.existsSync(premiumDir)) {
  fs.readdirSync(premiumDir).forEach((name) => {
    const entry = path.join(premiumDir, name, "index.js");
    if (fs.existsSync(entry)) {
      app.use("/api", requireAuth, requirePremiumModule(name), require(entry));
    }
  });
}

app.use((req, res) => {
  res.status(404).json({ error: "Ruta nije pronađena." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Nešto je pošlo po zlu na serveru." });
});

app.listen(PORT, () => {
  console.log(`EcommNode API server running on http://localhost:${PORT}`);
});
