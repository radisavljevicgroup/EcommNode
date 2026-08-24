const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectRouter = require("./routes/connect");
const ordersRouter = require("./routes/orders");
const analyticsRouter = require("./routes/analytics");
const settingsRouter = require("./routes/settings");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Vite dev server can pick a different port if the default one is busy
// (5173, 5174, ...), so allow any localhost origin in dev instead of a
// single fixed port. Set CLIENT_ORIGIN in .env to lock this down.
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || LOCALHOST_ORIGIN;

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.use("/api", connectRouter);
app.use("/api", ordersRouter);
app.use("/api", analyticsRouter);
app.use("/api", settingsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta nije pronađena." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Nešto je pošlo po zlu na serveru." });
});

app.listen(PORT, () => {
  console.log(`Shopstack API server running on http://localhost:${PORT}`);
});
