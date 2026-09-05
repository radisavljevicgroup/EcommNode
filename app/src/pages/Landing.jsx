import Logo from "../components/Logo";
import {
  PersonIcon,
  BagIcon,
  ChartIcon,
  CheckIcon,
  PlusIcon,
  TrendIcon,
  LayersIcon,
  UsersIcon,
} from "../icons";

const GITHUB_URL = "https://github.com/radisavljevicgroup/EcommNode";

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03a9.4 9.4 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

const PAIN_POINTS = [
  {
    title: "Rasut pregled poslovanja",
    desc: "Pet različitih naloga, pet različitih lozinki, pet različitih izveštaja ili analiza koje treba ručno sastaviti da bi znao kako ti zapravo ide prodavnica ovog meseca.",
  },
  {
    title: "Ne razumeju naše tržište",
    desc: "Većina rešenja je pravljena za zapadno tržište i ne mogu da prate potrebe i uslove za razvijanje našeg poslovanja.",
  },
  {
    title: "Problemi se primete prekasno",
    desc: "Pad konverzije, neuspela plaćanja, poskupljenje oglasa — bez nekoga ko svakog jutra otvara pet dashboarda, ovakve stvari prođu neprimećene danima.",
  },
  {
    title: "Nemaš kontrolu nad timom",
    desc: "Svi radite preko jednog istog naloga — nemaš nikakvu kontrolu ko je šta radio ili video.",
  },
];

const BENEFITS = [
  {
    icon: TrendIcon,
    title: "Brzina",
    desc: "Jedan login, jedan ekran. Ono za šta ti je trebalo pet otvorenih tabova i pola sata sastavljanja izveštaja ili analiza, sada je jedan pogled na početnu stranicu.",
  },
  {
    icon: LayersIcon,
    title: "Fleksibilnost",
    desc: "Kod je tvoj. EcommNode je rešenje koje možeš da razvijaš prema potrebama svog poslovanja u saradnji sa nama.",
  },
  {
    icon: ChartIcon,
    title: "Modularnost",
    desc: "WooCommerce, Shopify, Google Analytics, Search Console, Meta Ads, WhatsApp, Viber — svaka integracija je zaseban modul. Poveži samo ono što stvarno koristiš.",
  },
  {
    icon: UsersIcon,
    title: "Saradnja",
    desc: "Dodaj zaposlene i saradnike sa sopstvenim nalogom i ulogom — svako vidi tačno ono što mu je potrebno.",
  },
];

const ROADMAP_DONE = [
  "WooCommerce i Shopify — sinhronizacija porudžbina i kataloga",
  "Google Analytics 4 i Search Console na jednom mestu",
  "Meta Ads — potrošnja, ROAS i CAC po kampanji",
  "Objedinjen inbox — Messenger i Instagram",
  "Dashboard koji sam prijavljuje pad konverzije i neuspela plaćanja",
  "Podrška za više brendova, strogo odvojenih po podacima",
];

const ROADMAP_OPEN = [
  "Dodatne platforme i payment gateway integracije",
  "Napredna izveštavanja i izvoz podataka",
  "Još kanala u objedinjenom inboxu",
  "… i sve što zajednica predloži sledeće",
];

// Plain `href="#problem"` anchors would collide with the app's own
// hash-based router (App.jsx treats every hash change as a route) — an
// in-page jump would get reinterpreted as an unknown route and bounce
// straight to login. Scrolling by element id sidesteps the router entirely.
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Landing({ onNavigate }) {
  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <Logo />
        <nav className="landing-nav-links">
          <button type="button" onClick={() => scrollToSection("problem")}>
            Problem
          </button>
          <button type="button" onClick={() => scrollToSection("resenje")}>
            Rešenje
          </button>
          <button type="button" onClick={() => scrollToSection("zajednica")}>
            Zajednica
          </button>
        </nav>
        <div className="landing-topbar-cta">
          <button type="button" className="landing-btn-ghost" onClick={() => onNavigate("login")}>
            Prijavi se
          </button>
          <button type="button" className="landing-btn-primary" onClick={() => onNavigate("register")}>
            Registruj se
            <PersonIcon />
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">Open-source</span>
          <h1>Celo poslovanje u jednom tabu.</h1>
          <p className="landing-lede">
            EcommNode spaja WooCommerce i Shopify porudžbine, Google i Meta analitiku,
            Analizu prodaje i poruke kupaca sa svih kanala u jedan pregledan alat. Napravljen
            za vlasnike e-commerca, njihove zaposlene i saradnike.
          </p>
          <div className="landing-hero-ctas">
            <button type="button" className="landing-btn-primary lg" onClick={() => onNavigate("register")}>
              Isprobaj besplatno
              <PersonIcon />
            </button>
            <a className="landing-btn-ghost lg" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <GithubIcon />
              Pogledaj na GitHub-u
            </a>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="landing-mock-panel">
            <div className="landing-mock-head">
              <span className="landing-mock-badge">
                <BagIcon />
              </span>
              <span>Stanje poslovanja</span>
            </div>
            <div className="landing-mock-kpis">
              <div>
                <p className="l">Ukupan prihod</p>
                <p className="v">842.400 RSD</p>
              </div>
              <div>
                <p className="l">Stopa konverzije</p>
                <p className="v">7.5%</p>
              </div>
            </div>
            <div className="landing-mock-bars">
              <span style={{ height: "38%" }} />
              <span style={{ height: "55%" }} />
              <span style={{ height: "44%" }} />
              <span style={{ height: "70%" }} />
              <span style={{ height: "60%" }} />
              <span style={{ height: "85%" }} />
              <span style={{ height: "100%" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-problem" id="problem">
        <div className="landing-section-head">
          <span className="landing-eyebrow warn">Problem</span>
          <h2>Vođenje prodavnice danas znači žongliranje sa deset alata.</h2>
          <p>
            WooCommerce ili Shopify admin za porudžbine. Google Analytics za saobraćaj. Meta
            Ads Manager za oglase. Posebna aplikacija za Instagram ili FB poruke. Dok
            sastaviš celu sliku, pola radnog dana je već prošlo. Koliko ti se samo puta
            desilo da nisi video neku poruku od kupca?
          </p>
        </div>

        <div className="landing-pain-grid">
          {PAIN_POINTS.map((p, i) => (
            <div className="landing-pain-card" key={p.title}>
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>

        <p className="landing-problem-close">
          Rezultat: izgubljeno vreme, izgubljen novac i odluke donesene na osnovu polovine
          slike.
        </p>
      </section>

      <section className="landing-section" id="resenje">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Rešenje</span>
          <h2>EcommNode spaja sve u jedan pregled.</h2>
          <p>
            Poveži svoje prodavnice i naloge jednom — EcommNode dalje sam povlači
            porudžbine, analitiku i poruke i slaže ih u dashboard koji ima smisla.
          </p>
        </div>

        <div className="landing-benefits-grid">
          {BENEFITS.map((b) => (
            <div className="landing-benefit" key={b.title}>
              <span className="landing-benefit-mark">
                <b.icon />
              </span>
              <div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="landing-highlight">
          <b>Vodiš više brendova?</b> Filtriraj dashboard po brendu i budi siguran da se
          podaci jedne prodavnice nikad ne mešaju sa drugom — svaka GA4, Meta i porudžbina
          veza je strogo vezana za svoj brend.
        </div>
      </section>

      <section className="landing-section landing-roadmap">
        <div className="landing-section-head">
          <span className="landing-eyebrow neutral">Živ projekat</span>
          <h2>EcommNode se gradi u javnosti — i nikad nije &quot;gotov&quot;.</h2>
          <p>
            Ovo nije zamrznut proizvod koji se jednom isporuči. Svaka nedelja donosi nove
            integracije, popravke i funkcionalnosti — često direktno na predlog nekoga ko
            vodi svoju prodavnicu.
          </p>
        </div>

        <div className="landing-roadmap-grid">
          <div>
            <h3>Danas već radi</h3>
            <ul className="landing-roadmap-list done">
              {ROADMAP_DONE.map((item) => (
                <li key={item}>
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Na redu je zajednica</h3>
            <ul className="landing-roadmap-list open">
              {ROADMAP_OPEN.map((item) => (
                <li key={item}>
                  <PlusIcon />
                  {item}
                </li>
              ))}
            </ul>
            <p className="landing-roadmap-cta">
              Imaš ideju koja nedostaje?{" "}
              <a href={`${GITHUB_URL}/issues/new`} target="_blank" rel="noopener noreferrer">
                Otvori issue i predloži je →
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section" id="zajednica">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Zajednica</span>
          <h2>Napravljeno od zajednice, za zajednicu.</h2>
          <p>
            EcommNode nije proizvod jedne firme koji se povremeno &quot;otvori&quot;
            javnosti — otvorenog je koda od prvog dana. Svako ko vodi prodavnicu i naiđe na
            nešto što nedostaje, može to i da traži i da napravi.
          </p>
        </div>

        <div className="landing-path-grid">
          <div className="landing-path-card">
            <span className="tag">Nemaš vremena da kodiraš?</span>
            <h3>Predloži funkcionalnost</h3>
            <p>
              Opiši problem sa kojim se suočavaš u svojoj prodavnici — zajednica (ili mi)
              ćemo videti kako da ga rešimo.
            </p>
            <a
              className="landing-btn-ghost"
              href={`${GITHUB_URL}/issues/new`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Otvori issue
            </a>
          </div>
          <div className="landing-path-card">
            <span className="tag">Znaš da kodiraš?</span>
            <h3>Doprinesi kodom</h3>
            <p>
              Svaki modul — od nove integracije do popravke bagova — je dobrodošao doprinos.
              Kod je organizovan po integracijama, lako je snaći se.
            </p>
            <a className="landing-btn-primary" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <GithubIcon />
              Pogledaj repozitorijum
            </a>
          </div>
        </div>
      </section>

      <footer className="landing-footer-cta">
        <div className="landing-footer-inner">
          <span className="landing-eyebrow on-strong">Pridruži se</span>
          <h2>Spreman da vodiš prodavnicu iz jednog dashboarda?</h2>
          <p>Registracija traje manje od minuta — bez kartice, bez obaveza.</p>
          <div className="landing-hero-ctas">
            <button type="button" className="landing-btn-on-strong" onClick={() => onNavigate("register")}>
              Registruj se besplatno
              <PersonIcon />
            </button>
            <a className="landing-btn-ghost-strong" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <GithubIcon />
              Zvezdicu na GitHub-u
            </a>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <span>EcommNode — otvorenog koda, zajednički projekat.</span>
          <div className="landing-footer-links">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer">
              Issues
            </a>
            <a href={`${GITHUB_URL}/discussions`} target="_blank" rel="noopener noreferrer">
              Diskusije
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
