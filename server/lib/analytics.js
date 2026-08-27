const REALIZED_STATUSES = ["processing", "completed"];
const RETURNED_STATUSES = ["cancelled", "refunded"];
const DAY_MS = 1000 * 60 * 60 * 24;

function toNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// Customers are identified by phone number, not email — the same person
// often checks out with different/typo'd emails but keeps one phone number.
function normalizePhone(phone) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  // Serbian numbers appear both as "0601234567" and "381601234567"
  // (with or without a leading "+") — treat them as the same customer.
  if (digits.startsWith("381")) digits = `0${digits.slice(3)}`;
  return digits;
}

function customerKey(order) {
  return normalizePhone(order.billing?.phone);
}

// Different spellings that must collapse onto the same grouping key
// ("Beograd" and "Belgrade" are the same city, not two different ones).
const CITY_KEY_ALIASES = {
  belgrade: "beograd",
};

// Preferred display label once several spellings have been merged onto
// one key — otherwise whichever label has proper diacritics wins.
const CITY_LABEL_OVERRIDES = {
  beograd: "Beograd",
};

function stripDiacritics(s) {
  return s
    .replace(/[čć]/gi, (m) => (m === m.toUpperCase() ? "C" : "c"))
    .replace(/š/gi, (m) => (m === m.toUpperCase() ? "S" : "s"))
    .replace(/ž/gi, (m) => (m === m.toUpperCase() ? "Z" : "z"))
    .replace(/đ/gi, (m) => (m === m.toUpperCase() ? "Dj" : "dj"));
}

function normalizeCityKey(city) {
  const key = stripDiacritics(city.trim()).toLowerCase();
  return CITY_KEY_ALIASES[key] || key;
}

function inRange(dateStr, from, to) {
  const t = new Date(dateStr).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

function filterByRange(orders, from, to) {
  return orders.filter((o) => inRange(o.dateCreated, from, to));
}

function realized(orders) {
  return orders.filter((o) => REALIZED_STATUSES.includes(o.status));
}

function totalRevenue(orders) {
  return orders.reduce((sum, o) => sum + toNumber(o.total), 0);
}

function groupByCustomer(orders) {
  const map = new Map();
  orders.forEach((o) => {
    const key = customerKey(o);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(o);
  });
  return map;
}

function activeCustomerEmails(periodOrders) {
  return new Set(periodOrders.map(customerKey).filter(Boolean));
}

// ---- individual KPI formulas -------------------------------------------

function orderCount(periodOrders) {
  return realized(periodOrders).length;
}

function aov(periodOrders) {
  const r = realized(periodOrders);
  return r.length ? totalRevenue(r) / r.length : 0;
}

function upt(periodOrders) {
  const r = realized(periodOrders);
  if (!r.length) return 0;
  const units = r.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + (i.quantity || 0), 0),
    0
  );
  return units / r.length;
}

function shippingPercent(periodOrders) {
  const r = realized(periodOrders);
  const revenue = totalRevenue(r);
  if (!revenue) return 0;
  const shipping = r.reduce((sum, o) => sum + toNumber(o.shippingTotal), 0);
  return (shipping / revenue) * 100;
}

function rpr(periodOrders, allOrders) {
  const history = groupByCustomer(allOrders);
  const active = activeCustomerEmails(periodOrders);
  if (!active.size) return 0;
  let repeat = 0;
  active.forEach((email) => {
    if ((history.get(email) || []).length > 1) repeat += 1;
  });
  return (repeat / active.size) * 100;
}

function ltv(periodOrders, allOrders) {
  const history = groupByCustomer(allOrders);
  const active = activeCustomerEmails(periodOrders);
  if (!active.size) return 0;
  let total = 0;
  active.forEach((email) => {
    total += totalRevenue(realized(history.get(email) || []));
  });
  return total / active.size;
}

function tbo(periodOrders, allOrders) {
  const history = groupByCustomer(allOrders);
  const active = activeCustomerEmails(periodOrders);
  const gaps = [];
  active.forEach((email) => {
    const hist = [...(history.get(email) || [])].sort(
      (a, b) => new Date(a.dateCreated) - new Date(b.dateCreated)
    );
    for (let i = 1; i < hist.length; i += 1) {
      gaps.push((new Date(hist[i].dateCreated) - new Date(hist[i - 1].dateCreated)) / DAY_MS);
    }
  });
  return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
}

// Heuristic estimate (not a real predictive model): average order value
// times purchase frequency times estimated customer lifespan, derived from
// the actual spread of each customer's order dates in the dataset.
function clvEstimate(allOrders) {
  const r = realized(allOrders);
  if (!r.length) return 0;
  const avgOrderValue = totalRevenue(r) / r.length;

  const history = groupByCustomer(r);
  let freqSum = 0;
  let lifespanSum = 0;
  let n = 0;

  history.forEach((orders) => {
    const dates = orders.map((o) => new Date(o.dateCreated).getTime()).sort((a, b) => a - b);
    const spanDays = dates[dates.length - 1] - dates[0];
    const lifespanYears = Math.max(spanDays / (DAY_MS * 365), 1);
    freqSum += orders.length / lifespanYears;
    lifespanSum += lifespanYears;
    n += 1;
  });

  if (!n) return 0;
  const avgFreqPerYear = freqSum / n;
  const avgLifespanYears = lifespanSum / n;
  return avgOrderValue * avgFreqPerYear * avgLifespanYears;
}

function ofct(periodOrders) {
  const completed = periodOrders.filter((o) => o.dateCompleted);
  if (!completed.length) return 0;
  const totalDays = completed.reduce(
    (sum, o) => sum + (new Date(o.dateCompleted) - new Date(o.dateCreated)) / DAY_MS,
    0
  );
  return totalDays / completed.length;
}

function returnRate(periodOrders) {
  if (!periodOrders.length) return 0;
  const returned = periodOrders.filter((o) => RETURNED_STATUSES.includes(o.status)).length;
  return (returned / periodOrders.length) * 100;
}

// ---- aggregate entry points ---------------------------------------------

function computeSummary(allOrders, { from, to }) {
  const periodOrders = filterByRange(allOrders, from, to);
  return {
    orderCount: orderCount(periodOrders),
    aov: aov(periodOrders),
    upt: upt(periodOrders),
    shippingPercent: shippingPercent(periodOrders),
    rpr: rpr(periodOrders, allOrders),
    ltv: ltv(periodOrders, allOrders),
    tbo: tbo(periodOrders, allOrders),
    clv: clvEstimate(allOrders),
    ofct: ofct(periodOrders),
    returnRate: returnRate(periodOrders),
    currency: periodOrders[0]?.currency || allOrders[0]?.currency || "RSD",
  };
}

// ---- per-metric trend (for the "chart this metric" modal) --------------

function bucketRanges(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  const spanDays = Math.max((end - start) / DAY_MS, 1);

  let unit = "month";
  if (spanDays <= 31) unit = "day";
  else if (spanDays <= 180) unit = "week";

  const buckets = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    let bucketEnd;
    let next;
    if (unit === "day") {
      bucketEnd = new Date(cursor);
      bucketEnd.setHours(23, 59, 59, 999);
      next = new Date(cursor);
      next.setDate(next.getDate() + 1);
    } else if (unit === "week") {
      bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + 6);
      bucketEnd.setHours(23, 59, 59, 999);
      next = new Date(cursor);
      next.setDate(next.getDate() + 7);
    } else {
      bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    const clampedEnd = bucketEnd > end ? end : bucketEnd;
    const label =
      unit === "day"
        ? cursor.toISOString().slice(0, 10)
        : unit === "week"
          ? cursor.toISOString().slice(0, 10)
          : monthKey(cursor.toISOString());

    buckets.push({ from: cursor.toISOString(), to: clampedEnd.toISOString(), label });
    cursor = next;
  }

  return { unit, buckets };
}

function computeMetricTrend(allOrders, { from, to }, metricKey) {
  const { unit, buckets } = bucketRanges(from, to);
  const series = buckets.map((b) => {
    const summary = computeSummary(allOrders, { from: b.from, to: b.to });
    return { label: b.label, value: summary[metricKey] ?? 0 };
  });
  return {
    unit,
    series,
    currency: allOrders[0]?.currency || "RSD",
  };
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftYears(dateStr, years) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

function monthlyRevenueMap(orders, from, to) {
  const periodOrders = realized(filterByRange(orders, from, to));
  const map = new Map();
  periodOrders.forEach((o) => {
    const key = monthKey(o.dateCreated);
    map.set(key, (map.get(key) || 0) + toNumber(o.total));
  });
  return map;
}

function computeTrends(allOrders, { from, to }) {
  const current = monthlyRevenueMap(allOrders, from, to);
  const lastYearFrom = from ? shiftYears(from, -1) : null;
  const lastYearTo = to ? shiftYears(to, -1) : null;
  const previous = monthlyRevenueMap(allOrders, lastYearFrom, lastYearTo);

  const months = [...current.keys()].sort();
  const series = months.map((m) => ({ month: m, revenue: current.get(m) || 0 }));

  const currentTotal = [...current.values()].reduce((a, b) => a + b, 0);
  const previousTotal = [...previous.values()].reduce((a, b) => a + b, 0);
  const yoyPercent = previousTotal ? ((currentTotal - previousTotal) / previousTotal) * 100 : null;

  return { series, yoyPercent, currentTotal, previousTotal };
}

function computeTopProducts(
  allOrders,
  { from, to, sortBy = "revenue" },
  productCategoryMap,
  categoryImageMap,
  limit = 10
) {
  const periodOrders = realized(filterByRange(allOrders, from, to));
  const productMap = new Map();
  // Keyed by site+name, never merged across stores — the same category
  // name in two different stores is two different categories with two
  // different product sets, and ranking them together would misattribute
  // revenue to a single "site" that isn't real.
  const categoryMap = new Map();

  periodOrders.forEach((o) => {
    o.items.forEach((item) => {
      const key = item.productId || item.name;
      const revenue = toNumber(item.total);
      if (!productMap.has(key)) {
        productMap.set(key, {
          id: item.productId,
          name: item.name,
          sku: item.sku || "",
          image: item.image || null,
          revenue: 0,
          units: 0,
        });
      }
      const p = productMap.get(key);
      p.revenue += revenue;
      p.units += item.quantity || 0;
      if (!p.image && item.image) p.image = item.image;
      if (!p.sku && item.sku) p.sku = item.sku;

      const categories = productCategoryMap?.get(item.productId) || ["Nekategorisano"];
      const site = o.sourceSiteUrl || null;
      categories.forEach((cat) => {
        const catKey = `${site || ""}::${cat}`;
        if (!categoryMap.has(catKey)) {
          categoryMap.set(catKey, { name: cat, site, revenue: 0 });
        }
        categoryMap.get(catKey).revenue += revenue;
      });
    });
  });

  const sortKey = sortBy === "units" ? "units" : "revenue";
  const products = [...productMap.values()].sort((a, b) => b[sortKey] - a[sortKey]);
  const categories = [...categoryMap.values()]
    .map((c) => ({
      name: c.name,
      site: c.site,
      revenue: c.revenue,
      image: c.site ? categoryImageMap?.get(`${c.site}::${c.name}`) || null : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return {
    bestsellers: products.slice(0, limit),
    slowMovers: products.slice(-limit).reverse(),
    categories,
  };
}

function computeGeoDistribution(allOrders, { from, to }, limit = 15) {
  const periodOrders = realized(filterByRange(allOrders, from, to));
  const map = new Map(); // normalized key -> { label, revenue }

  periodOrders.forEach((o) => {
    const rawCity = (o.shipping?.city || o.billing?.city || "Nepoznato").trim();
    const key = normalizeCityKey(rawCity);
    const label = CITY_LABEL_OVERRIDES[key] || rawCity;
    const revenue = toNumber(o.total);

    const existing = map.get(key);
    if (existing) {
      existing.revenue += revenue;
      // Prefer a label with proper diacritics if we come across one
      // ("Niš" over "Nis", "Čačak" over "Cacak").
      if (!/[čćšžđ]/i.test(existing.label) && /[čćšžđ]/i.test(label)) {
        existing.label = label;
      }
    } else {
      map.set(key, { label, revenue });
    }
  });

  return [...map.values()]
    .map(({ label, revenue }) => ({ city: label, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

module.exports = {
  computeSummary,
  computeTrends,
  computeTopProducts,
  computeGeoDistribution,
  computeMetricTrend,
  filterByRange,
  realized,
  customerKey,
  groupByCustomer,
  normalizeCityKey,
};
