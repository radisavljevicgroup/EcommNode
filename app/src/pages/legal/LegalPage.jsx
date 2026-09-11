import Logo from "../../components/Logo";

// Shared chrome for the legal pages (Privacy, Terms, Data deletion) — these
// are reachable without a session (see App.jsx's PUBLIC_ROUTES) since
// they're the URLs pasted into the Meta App Dashboard's Privacy Policy URL
// / Terms of Service URL / Data Deletion Instructions URL fields, and Meta's
// reviewer opens them logged out.
export default function LegalPage({ title, updated, children }) {
  return (
    <div className="landing-page legal-page">
      <header className="landing-topbar">
        <Logo />
        <a className="landing-btn-ghost" href="#/landing">
          Nazad na početnu
        </a>
      </header>

      <section className="landing-section legal-content">
        <h1>{title}</h1>
        <p className="legal-updated">Poslednja izmena: {updated}</p>
        {children}
      </section>
    </div>
  );
}
