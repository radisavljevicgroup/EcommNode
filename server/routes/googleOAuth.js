// Shared landing page for Google's OAuth redirect — both /ga4/oauth/start
// and /gsc/oauth/start (routes/ga4.js, routes/gsc.js) point Google at this
// SAME callback (see googleOAuthClient.js's redirectUri) so only one URI
// needs registering in Google Cloud Console's "Authorized redirect URIs";
// which product/company a given round trip belongs to travels in `state`.
//
// Deliberately mounted WITHOUT requireAuth in server/index.js (like
// routes/inbox.js's webhook receivers) — Google's redirect is a plain
// browser navigation with no way to attach our Supabase Authorization
// header, so the merchant's identity has to already be bound to `state`
// from the authenticated /oauth/start call that created it.
const { Router } = require("express");
const ga4 = require("../lib/ga4");
const gsc = require("../lib/gsc");
const {
  takeState,
  stashPending,
  exchangeCodeForTokens,
  fetchGoogleEmail,
} = require("../lib/googleOAuthClient");

const router = Router();

const OAUTH_MESSAGE_SOURCE = "ecommnode-google-oauth";

// JS line/paragraph separator code points — built from charCodeAt/escape
// helpers rather than typed as a literal escape sequence in this source
// file, since that literal sequence itself gets read back as the real
// (invisible, line-breaking) character by some tooling around this repo.
const JS_LINE_SEPARATOR_CODE = 0x2028;
const JS_PARAGRAPH_SEPARATOR_CODE = 0x2029;
const LINE_SEPARATOR_RE = new RegExp(String.fromCharCode(JS_LINE_SEPARATOR_CODE), "g");
const PARAGRAPH_SEPARATOR_RE = new RegExp(String.fromCharCode(JS_PARAGRAPH_SEPARATOR_CODE), "g");
function jsEscape(code) {
  return "\\u" + code.toString(16).padStart(4, "0");
}

// Embeds `payload` as a JS object literal inside an inline <script> —
// escape "<" (breaks out via "</script>") and the two JS source
// line-terminator code points above (a value with one of those raw inside
// a script body is also a syntax error, not just an XSS concern).
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(LINE_SEPARATOR_RE, jsEscape(JS_LINE_SEPARATOR_CODE))
    .replace(PARAGRAPH_SEPARATOR_RE, jsEscape(JS_PARAGRAPH_SEPARATOR_CODE));
}

function renderPopupResult(appOrigin, payload) {
  return `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        try {
          if (window.opener) {
            window.opener.postMessage(${safeJson(payload)}, ${safeJson(appOrigin || "*")});
          }
        } finally {
          window.close();
        }
      })();
    </script>
    <p>Možeš zatvoriti ovaj prozor.</p>
  </body>
</html>`;
}

router.get("/google/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const entry = state ? takeState(state) : null;

  if (!entry) {
    res
      .status(400)
      .type("html")
      .send(
        renderPopupResult(process.env.CLIENT_ORIGIN, {
          source: OAUTH_MESSAGE_SOURCE,
          ok: false,
          error: "Sesija povezivanja sa Google nalogom je istekla — probaj ponovo.",
        })
      );
    return;
  }

  const { company, product, appOrigin } = entry;

  if (error) {
    res.type("html").send(
      renderPopupResult(appOrigin, {
        source: OAUTH_MESSAGE_SOURCE,
        product,
        ok: false,
        error: "Prijava na Google je otkazana ili odbijena.",
      })
    );
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      throw new Error(
        "Google nije vratio refresh token — probaj ponovo i dozvoli pristup kad se zatraži."
      );
    }

    const [email, items] = await Promise.all([
      fetchGoogleEmail(tokens.access_token),
      product === "ga4" ? ga4.listProperties(tokens.access_token) : gsc.listSites(tokens.access_token),
    ]);

    const pendingId = stashPending({
      company,
      product,
      refreshToken: tokens.refresh_token,
      items,
      email,
    });

    res.type("html").send(
      renderPopupResult(appOrigin, {
        source: OAUTH_MESSAGE_SOURCE,
        product,
        ok: true,
        pendingId,
        items,
        email,
      })
    );
  } catch (err) {
    res.type("html").send(
      renderPopupResult(appOrigin, {
        source: OAUTH_MESSAGE_SOURCE,
        product,
        ok: false,
        error: err.message || "Povezivanje sa Google nalogom nije uspelo.",
      })
    );
  }
});

module.exports = router;
