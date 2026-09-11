import LegalPage from "./LegalPage";

const CONTACT_EMAIL = "matijaradisavljevic18@gmail.com";
const GITHUB_URL = "https://github.com/radisavljevicgroup/EcommNode";

export default function Terms() {
  return (
    <LegalPage title="Uslovi korišćenja" updated="11. septembar 2026.">
      <p>
        Korišćenjem EcommNode-a (<strong>ecommnode.com</strong>) prihvatate ove uslove
        korišćenja. Ako se ne slažete sa njima, nemojte koristiti uslugu.
      </p>

      <h2>1. Šta je EcommNode</h2>
      <p>
        EcommNode je dashboard koji objedinjuje podatke sa platformi koje sami povežete
        (WooCommerce, Shopify, Google Analytics 4, Search Console, Meta Ads, Messenger,
        Instagram, WhatsApp Business, Viber) i prikazuje ih na jednom mestu. Izvorni kod je
        otvoren i dostupan na{" "}
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub-u
        </a>
        ; ecommnode.com je hostovana instanca te aplikacije.
      </p>

      <h2>2. Nalog</h2>
      <p>
        Odgovorni ste za tačnost podataka koje unesete i za čuvanje svojih pristupnih podataka
        u tajnosti. Obavestite nas odmah ako posumnjate na neovlašćeni pristup vašem nalogu.
      </p>

      <h2>3. Povezivanje trećih platformi</h2>
      <p>
        Kada povežete WooCommerce, Shopify, Google ili Meta nalog, ovlašćujete EcommNode da u
        vaše ime, koristeći tokene koje sami odobrite, čita (a kod pojedinih integracija koje
        sami uključite, i piše — npr. automatska sinhronizacija zaliha) podatke sa te platforme
        isključivo u svrhu prikazivanja izveštaja i funkcionalnosti koje ste sami zatražili.
        Vezu možete ukinuti u bilo kom trenutku iz Podešavanja → Integracije.
      </p>

      <h2>4. Prihvatljivo korišćenje</h2>
      <p>
        Ne smete koristiti EcommNode za nezakonite svrhe, pokušaje neovlašćenog pristupa tuđim
        nalozima ili narušavanje rada usluge.
      </p>

      <h2>5. Dostupnost usluge</h2>
      <p>
        Trudimo se da usluga bude dostupna neprekidno, ali je pružamo &quot;kakva jeste&quot;,
        bez garancije neprekidnog rada bez prekida ili grešaka, uključujući prekide uzrokovane
        promenama na API-jima trećih platformi (Meta, Google, WooCommerce, Shopify) van naše
        kontrole.
      </p>

      <h2>6. Raskid</h2>
      <p>
        Nalog i sve povezane podatke možete obrisati u bilo kom trenutku — pogledajte{" "}
        <a href="#/brisanje-podataka">uputstvo za brisanje podataka</a>.
      </p>

      <h2>7. Izmene uslova</h2>
      <p>
        Ako izmenimo ove uslove, datum na vrhu stranice će biti ažuriran. Nastavak korišćenja
        usluge posle izmene znači prihvatanje novih uslova.
      </p>

      <h2>8. Merodavno pravo</h2>
      <p>Na ove uslove primenjuje se pravo Republike Srbije.</p>

      <h2>9. Kontakt</h2>
      <p>
        Pitanja u vezi sa uslovima korišćenja: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
