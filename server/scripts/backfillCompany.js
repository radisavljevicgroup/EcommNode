// One-time migration: every record that existed before company-scoping was
// added (2026-09-03) belongs to the only real company that's ever used this
// deployment — Eurocom International d.o.o. New records from here on carry
// their own `company` field, stamped from the caller's Supabase profile.
const fs = require("fs");
const path = require("path");

const COMPANY = "Eurocom International d.o.o";
const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(file, fallback) {
  const filePath = path.join(DATA_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(value, null, 2));
}

function backfillArray(file) {
  const list = readJson(file, []);
  if (!Array.isArray(list)) return;
  let changed = 0;
  const next = list.map((item) => {
    if (item.company) return item;
    changed += 1;
    return { ...item, company: COMPANY };
  });
  writeJson(file, next);
  console.log(`${file}: stamped ${changed}/${list.length}`);
}

// settings.json used to be one flat object shared by everyone — becomes
// { [company]: {...} }.
function backfillSettings() {
  const current = readJson("settings.json", {});
  if (current[COMPANY]) {
    console.log("settings.json: already migrated");
    return;
  }
  // Old shape has these top-level keys directly; new shape doesn't.
  const looksLegacy =
    "staleOrderThresholdDays" in current ||
    "staleTrackingEnabled" in current ||
    "enabledPremiumTools" in current;
  writeJson("settings.json", looksLegacy ? { [COMPANY]: current } : current);
  console.log(`settings.json: ${looksLegacy ? "migrated legacy object" : "no legacy data"}`);
}

// calendar.json used to be one flat { categories, events } shared by
// everyone — becomes { [company]: { categories, events } }.
function backfillCalendar() {
  const current = readJson("calendar.json", {});
  if (current[COMPANY]) {
    console.log("calendar.json: already migrated");
    return;
  }
  const looksLegacy = Array.isArray(current.categories) || Array.isArray(current.events);
  writeJson("calendar.json", looksLegacy ? { [COMPANY]: current } : current);
  console.log(`calendar.json: ${looksLegacy ? "migrated legacy object" : "no legacy data"}`);
}

backfillArray("connections.json");
backfillArray("shopify-connections.json");
backfillArray("ga4-connections.json");
backfillArray("gsc-connections.json");
backfillArray("meta-connections.json");
backfillArray("eurocom-connections.json");
backfillArray("inbox-connections.json");
backfillSettings();
backfillCalendar();

console.log("Done.");
