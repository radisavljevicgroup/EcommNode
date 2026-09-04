// One-time migration companion to supabase-pib-unique-migration.sql: once
// req.company is sourced from the new `token` column instead of the old
// free-text `company` column (see server/lib/auth.js), every local JSON
// store below is still keyed by the OLD company name string — this data
// would otherwise become orphaned (unreachable, since nothing will ever
// look it up by that key again).
//
// Usage: node scripts/rekeyCompanyToToken.js "<old company name>" "<new token>"
// Run once per existing company, after finding its owner's token in
// Supabase (select token from users where pib = '<owner's real pib>') —
// this doesn't touch Supabase, only the local server/data/*.json files
// listed below (the same set server/scripts/backfillCompany.js originally
// stamped).
const fs = require("fs");
const path = require("path");

const [OLD_KEY, NEW_KEY] = process.argv.slice(2);
if (!OLD_KEY || !NEW_KEY) {
  console.error('Usage: node scripts/rekeyCompanyToToken.js "<old company name>" "<new token>"');
  process.exit(1);
}

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

function rekeyArray(file) {
  const list = readJson(file, []);
  if (!Array.isArray(list)) return;
  let changed = 0;
  const next = list.map((item) => {
    if (item.company !== OLD_KEY) return item;
    changed += 1;
    return { ...item, company: NEW_KEY };
  });
  writeJson(file, next);
  console.log(`${file}: rekeyed ${changed}/${list.length}`);
}

function rekeyObjectStore(file) {
  const current = readJson(file, {});
  if (!(OLD_KEY in current)) {
    console.log(`${file}: no data under old key, skipped`);
    return;
  }
  if (NEW_KEY in current) {
    console.error(`${file}: new key already has data — refusing to overwrite, merge by hand.`);
    return;
  }
  const { [OLD_KEY]: value, ...rest } = current;
  writeJson(file, { ...rest, [NEW_KEY]: value });
  console.log(`${file}: rekeyed`);
}

rekeyArray("connections.json");
rekeyArray("shopify-connections.json");
rekeyArray("ga4-connections.json");
rekeyArray("gsc-connections.json");
rekeyArray("meta-connections.json");
rekeyArray("eurocom-connections.json");
rekeyArray("inbox-connections.json");
rekeyObjectStore("settings.json");
rekeyObjectStore("calendar.json");

console.log("Done.");
