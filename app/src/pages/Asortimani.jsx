// "Asortimani" (firme koje nude svoj asortiman drugim prodavnicama) lives in
// the private ecommnode-premium repo, like the IT Infrastruktura
// integrations — app/src/premium/asortimani/AsortimaniPage.jsx. Without it
// the glob matches nothing and Header hides the nav item (HAS_ASORTIMANI).
const premiumPages = import.meta.glob("../premium/*/AsortimaniPage.jsx", { eager: true });
const AsortimaniPage = Object.values(premiumPages)[0]?.default;

export const HAS_ASORTIMANI = Boolean(AsortimaniPage);

export default function Asortimani() {
  if (!AsortimaniPage) {
    return <div className="empty-hint">Asortimani nisu dostupni.</div>;
  }
  return <AsortimaniPage />;
}
