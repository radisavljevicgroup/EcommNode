const { createJsonFile } = require("./jsonFile");

// A Map-like report cache kept on disk (server/data/<name>.json), so it
// survives the Node process being restarted — a deploy, the manual kill
// after it, or CloudLinux stopping an idle worker. In memory only, every
// restart left GA4 / Search Console / Meta reach empty and the first page
// load after it waited on Google/Meta again (10-20s), however recently the
// same numbers had been fetched.
//
// Entries are { data, at }. Writes are batched; entries not refreshed for
// MAX_AGE_MS are dropped on load so old date ranges don't pile up.
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const WRITE_DELAY_MS = 2000;

function createDiskCache(name) {
  const file = createJsonFile(`${name}.json`, {});
  const map = new Map();
  const now = Date.now();
  Object.entries(file.read() || {}).forEach(([key, entry]) => {
    if (entry && typeof entry.at === "number" && now - entry.at < MAX_AGE_MS) map.set(key, entry);
  });

  let timer = null;
  function save() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        file.write(Object.fromEntries(map));
      } catch (err) {
        console.warn(`[disk-cache] ${name}:`, err.message);
      }
    }, WRITE_DELAY_MS);
  }

  return {
    get: (key) => map.get(key),
    set(key, entry) {
      map.set(key, entry);
      save();
      return this;
    },
  };
}

module.exports = { createDiskCache };
