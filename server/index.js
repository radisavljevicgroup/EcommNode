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
const metaRouter = require("./routes/meta");
const workersRouter = require("./routes/workers");
const inboxRouter = require("./routes/inbox");
const dashboardRouter = require("./routes/dashboard");
const calendarRouter = require("./routes/calendar");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Vite dev server can pick a different port if the default one is busy
// (5173, 5174, ...), so allow any localhost origin in dev instead of a
// single fixed port. Set CLIENT_ORIGIN in .env to lock this down.
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || LOCALHOST_ORIGIN;

app.use(cors({ origin: CLIENT_ORIGIN }));
// Captures the exact request bytes alongside the parsed body — the Meta
// inbox webhook (routes/inbox.js) needs the raw payload to verify
// X-Hub-Signature-256, since re-serializing the parsed JSON isn't
// guaranteed to byte-match what Meta actually signed.
app.use(express.json({ limit: "10mb", verify: (req, res, buf) => { req.rawBody = buf; } }));

app.use("/api", connectRouter);
app.use("/api", shopifyRouter);
app.use("/api", ordersRouter);
app.use("/api", analyticsRouter);
app.use("/api", settingsRouter);
app.use("/api", ga4Router);
app.use("/api", gscRouter);
app.use("/api", metaRouter);
app.use("/api", workersRouter);
app.use("/api", inboxRouter);
app.use("/api", dashboardRouter);
app.use("/api", calendarRouter);

// Premium integrations (e.g. Eurocom International) live outside this
// open-source repo — each one is a self-contained router at
// server/premium/<name>/index.js. That folder is gitignored, so a public
// checkout simply has none of them and this loop mounts nothing.
const premiumDir = path.join(__dirname, "premium");
if (fs.existsSync(premiumDir)) {
  fs.readdirSync(premiumDir).forEach((name) => {
    const entry = path.join(premiumDir, name, "index.js");
    if (fs.existsSync(entry)) {
      app.use("/api", require(entry));
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
