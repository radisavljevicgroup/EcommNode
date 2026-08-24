const { Router } = require("express");
const { getSettings, updateSettings } = require("../lib/settingsStore");

const router = Router();

router.get("/settings", (req, res) => {
  res.json(getSettings());
});

router.put("/settings", (req, res) => {
  const { staleOrderThresholdDays } = req.body || {};
  if (staleOrderThresholdDays === undefined) {
    return res.json(getSettings());
  }
  const n = Number(staleOrderThresholdDays);
  if (!Number.isFinite(n) || n <= 0) {
    return res.status(400).json({ error: "Broj dana mora biti pozitivan broj." });
  }
  res.json(updateSettings({ staleOrderThresholdDays: n }));
});

module.exports = router;
