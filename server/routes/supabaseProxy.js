const express = require("express");

// Pass-through proxy for the browser's Supabase client (auth, PostgREST,
// storage): api.ecommnode.com/supabase/* → SUPABASE_URL/*.
//
// Why: on 2026-10-27 login on ecommnode.com failed with "Failed to fetch"
// (blank screen) because Chrome on some networks times out reaching
// <project>.supabase.co directly (ERR_TIMED_OUT), while the same machine
// reaches it fine with curl/Node and reaches api.ecommnode.com fine from the
// browser. Routing the browser's Supabase traffic through this API keeps the
// app independent of that network path. The anon key and the user's JWT are
// forwarded as-is — RLS still applies exactly as before; this adds no
// privileges.
//
// Mounted BEFORE express.json() in index.js so the request body arrives
// here untouched (express.raw below), whatever its content type.

const router = express.Router();

// Request headers the Supabase client actually sends and Supabase needs.
// Everything else (Host, Origin, Cookie, Accept-Encoding, hop-by-hop...) is
// dropped.
const FORWARD_REQUEST_HEADERS = [
  "apikey",
  "authorization",
  "content-type",
  "accept",
  "accept-profile",
  "content-profile",
  "prefer",
  "range",
  "range-unit",
  "x-client-info",
  "x-supabase-api-version",
  "x-upsert",
  "cache-control",
];

// fetch() already decoded the body, so the upstream encoding/length no
// longer describe what we send; CORS is handled by the app-wide cors().
const DROP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "alt-svc",
]);

router.use(express.raw({ type: () => true, limit: "25mb" }));

router.all("/{*path}", async (req, res, next) => {
  const base = process.env.SUPABASE_URL;
  if (!base) return res.status(500).json({ error: "SUPABASE_URL nije podešen na serveru." });

  const headers = {};
  for (const name of FORWARD_REQUEST_HEADERS) {
    if (req.headers[name] !== undefined) headers[name] = req.headers[name];
  }

  const hasBody = !["GET", "HEAD"].includes(req.method) && Buffer.isBuffer(req.body) && req.body.length;

  try {
    const upstream = await fetch(base.replace(/\/$/, "") + req.url, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      redirect: "manual",
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, name) => {
      if (DROP_RESPONSE_HEADERS.has(name) || name.startsWith("access-control-")) return;
      res.setHeader(name, value);
    });
    // supabase-js reads Content-Range for { count } queries.
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Profile, X-Supabase-Api-Version");

    const body = Buffer.from(await upstream.arrayBuffer());
    res.end(body);
  } catch (err) {
    console.error("[supabase-proxy]", req.method, req.url, err.message);
    if (!res.headersSent) res.status(502).json({ error: "Supabase nije dostupan.", message: err.message });
    else next(err);
  }
});

module.exports = router;
