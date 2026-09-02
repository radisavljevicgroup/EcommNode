// Minimal RSD<->EUR conversion for comparing WooCommerce revenue (RSD)
// against Meta ad spend (EUR) — e.g. ROAS. Rates come from open.er-api.com
// (free, no API key) and are cached for a while since RSD/EUR barely
// moves day to day (the dinar is kept in a narrow managed band around
// ~117.5 by the National Bank of Serbia), so a half-day-stale rate is
// still accurate enough for a dashboard estimate.
//
// Frankfurter (ECB reference rates) was tried first, but the ECB doesn't
// publish a RSD rate at all — only major currencies — so it 404s for this
// pair specifically.
const RATE_CACHE_MS = 12 * 60 * 60 * 1000;
const FALLBACK_RSD_PER_EUR = 117.3;

let cached = null; // { rate, fetchedAt }

async function getRsdPerEur() {
  if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_MS) return cached.rate;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/EUR");
    const data = await res.json();
    const rate = data.rates?.RSD;
    if (!rate) throw new Error("Odgovor ne sadrži RSD kurs.");
    cached = { rate, fetchedAt: Date.now() };
    return rate;
  } catch {
    // Network hiccup or the API is down — fall back to the last rate we
    // actually fetched, or the hardcoded peg if we've never fetched one.
    return cached?.rate || FALLBACK_RSD_PER_EUR;
  }
}

// Only RSD<->EUR is implemented — the only pair this app ever needs
// (WooCommerce store currency vs Meta ad account currency). Anything else
// returns null rather than silently pretending to convert.
async function convert(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  if (fromCurrency === "RSD" && toCurrency === "EUR") return amount / (await getRsdPerEur());
  if (fromCurrency === "EUR" && toCurrency === "RSD") return amount * (await getRsdPerEur());
  return null;
}

module.exports = { convert, getRsdPerEur };
