import LegalPage from "./LegalPage";

const CONTACT_EMAIL = "matijaradisavljevic18@gmail.com";

export default function Privacy() {
  return (
    <LegalPage title="Politika privatnosti" updated="11. septembar 2026.">
      <p>
        Ova politika privatnosti objašnjava koje podatke EcommNode (
        <strong>ecommnode.com</strong>) prikuplja, kako ih koristi i kako ih čuva, uključujući
        podatke koje EcommNode učitava preko integracija sa trećim platformama (Meta, Google,
        WooCommerce, Shopify).
      </p>

      <h2>1. Ko smo</h2>
      <p>
        EcommNode je alat za vlasnike e-commerce prodavnica koji na jednom mestu objedinjuje
        porudžbine, analitiku prodaje i saobraćaja, performanse oglasa i poruke kupaca sa više
        kanala. Za pitanja o privatnosti obratite nam se na{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Koje podatke prikupljamo</h2>
      <ul>
        <li>
          <strong>Podaci naloga</strong> — ime, e-mail adresa i lozinka (u hešovanom obliku)
          prilikom registracije, i profilna slika ako je postavite.
        </li>
        <li>
          <strong>Podaci integracija koje sami povežete</strong> — pristupni tokeni i
          identifikatori za WooCommerce/Shopify prodavnicu, Google Analytics 4 i Search
          Console, Meta Ads oglasni nalog, i Messenger/Instagram/WhatsApp/Viber poslovne
          naloge. Ovi podaci se koriste isključivo da bismo u vaše ime čitali (a kod nekih
          integracija, na vaš eksplicitni zahtev, i upisivali — npr. ažuriranje zaliha) podatke
          sa tih platformi i prikazali ih u vašem EcommNode dashboard-u.
        </li>
        <li>
          <strong>Poslovni podaci sa povezanih platformi</strong> — porudžbine, proizvodi,
          zalihe, potrošnja i performanse oglasa, poruke kupaca — sve povučeno preko API-ja tih
          platformi koristeći tokene koje ste sami odobrili.
        </li>
      </ul>

      <h2>3. Meta (Facebook/Instagram) dozvole — šta tačno radimo s njima</h2>
      <p>
        Kada povežete Meta Ads preko dugmeta „Poveži se sa Facebook-om“, tražimo isključivo{" "}
        <code>ads_read</code> dozvolu da bismo prikazali potrošnju, doseg i konverzije vaših
        oglasa unutar EcommNode dashboard-a. Ne kreiramo, ne menjamo i ne gasimo oglase u vaše
        ime. Za objedinjeni inbox (Messenger/Instagram Direct) tražimo samo dozvole potrebne za
        čitanje i slanje poruka u ime stranice koju sami odaberete.
      </p>

      <h2>4. Kako čuvamo podatke</h2>
      <p>
        Podaci naloga (ime, e-mail, uloga, kompanija) čuvaju se u Supabase bazi. Pristupni
        tokeni i podešavanja integracija čuvaju se na serverskoj infrastrukturi koja pokreće
        vašu EcommNode instancu i nisu dostupni javno niti se dele sa trećim licima van poziva
        ka platformi na koju se sami tiču (npr. vaš Meta token se koristi samo za pozive ka
        Meta Graph API-ju).
      </p>

      <h2>5. Sa kim delimo podatke</h2>
      <p>
        Ne prodajemo i ne delimo vaše podatke trećim licima u marketinške svrhe. Podaci se
        razmenjuju isključivo sa platformama koje ste sami povezali (Meta, Google, WooCommerce,
        Shopify), i to samo u meri potrebnoj da EcommNode prikaže tražene izveštaje.
      </p>

      <h2>6. Koliko dugo čuvamo podatke</h2>
      <p>
        Podatke integracije čuvamo dok je integracija aktivna. Možete je ukloniti u bilo kom
        trenutku iz Podešavanja → Integracije — token se odmah briše sa servera. Za brisanje
        celog naloga i svih povezanih podataka pogledajte{" "}
        <a href="#/brisanje-podataka">uputstvo za brisanje podataka</a>.
      </p>

      <h2>7. Vaša prava</h2>
      <p>
        U skladu sa Zakonom o zaštiti podataka o ličnosti Republike Srbije, imate pravo da
        zatražite uvid, ispravku ili brisanje svojih ličnih podataka. Zahtev možete poslati na{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>8. Kolačići</h2>
      <p>
        EcommNode koristi isključivo tehnički neophodne kolačiće/lokalno skladište za održavanje
        vaše prijave (Supabase autentifikacija). Ne koristimo kolačiće za praćenje ili
        oglašavanje treće strane na sopstvenom sajtu.
      </p>

      <h2>9. Izmene ove politike</h2>
      <p>
        Ako promenimo ovu politiku, datum na vrhu stranice će biti ažuriran. Značajne izmene
        ćemo najaviti unutar aplikacije.
      </p>

      <h2>10. Kontakt</h2>
      <p>
        Pitanja u vezi sa privatnošću: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
