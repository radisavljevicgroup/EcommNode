// Google's and Meta's OAuth apps behind every "Poveži se sa ..." login
// (GA4/GSC in Ga4ConnectModal.jsx/GscConnectModal.jsx, Meta Ads/Pages in
// MetaAdsConnectModal.jsx/MetaPagesConnectModal.jsx) are still in
// test/development mode — only accounts added as a test user (Google) or
// given a role on the app (Meta) can actually log in. Without this notice
// a merchant just hits a confusing "access blocked"/"app not active"
// error mid-popup with no idea why or what to do about it.
export default function TestModeNotice({ provider }) {
  return (
    <p className="woo-notice">
      {provider} integracija je trenutno u test režimu — prijaviti se može samo nalog koji je
      unapred odobren. Ako dobiješ grešku pri prijavi, pošalji email na{" "}
      <a href="mailto:matija@radisavljevic.group">matija@radisavljevic.group</a> da te dodamo na
      listu.
    </p>
  );
}
