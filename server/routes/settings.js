const { Router } = require("express");
const { getSettings, updateSettings } = require("../lib/settingsStore");

const router = Router();

router.get("/settings", (req, res) => {
  res.json(getSettings(req.company));
});

router.put("/settings", (req, res) => {
  const {
    staleOrderThresholdDays,
    staleTrackingEnabled,
    unfiscalizedTrackingEnabled,
    enabledPremiumTools,
    internalOrdersCount,
    personalizationEnabled,
    personalizationProductIds,
  } = req.body || {};
  const patch = {};

  if (staleOrderThresholdDays !== undefined) {
    const n = Number(staleOrderThresholdDays);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ error: "Broj dana mora biti pozitivan broj." });
    }
    patch.staleOrderThresholdDays = n;
  }
  if (staleTrackingEnabled !== undefined) {
    patch.staleTrackingEnabled = Boolean(staleTrackingEnabled);
  }
  if (unfiscalizedTrackingEnabled !== undefined) {
    patch.unfiscalizedTrackingEnabled = Boolean(unfiscalizedTrackingEnabled);
  }
  if (enabledPremiumTools !== undefined) {
    if (
      !Array.isArray(enabledPremiumTools) ||
      !enabledPremiumTools.every((k) => typeof k === "string")
    ) {
      return res.status(400).json({ error: "enabledPremiumTools mora biti niz stringova." });
    }
    patch.enabledPremiumTools = enabledPremiumTools;
  }
  if (internalOrdersCount !== undefined) {
    const n = Number(internalOrdersCount);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ error: "Broj porudžbina mora biti pozitivan ceo broj." });
    }
    patch.internalOrdersCount = n;
  }
  if (personalizationEnabled !== undefined) {
    patch.personalizationEnabled = Boolean(personalizationEnabled);
  }
  if (personalizationProductIds !== undefined) {
    if (
      !Array.isArray(personalizationProductIds) ||
      !personalizationProductIds.every((id) => typeof id === "string" || typeof id === "number")
    ) {
      return res.status(400).json({ error: "personalizationProductIds mora biti niz ID-jeva." });
    }
    patch.personalizationProductIds = personalizationProductIds.map((id) => String(id).trim()).filter(Boolean);
  }

  res.json(updateSettings(req.company, patch));
});

module.exports = router;
