import LegalPage from "./LegalPage";

const CONTACT_EMAIL = "matijaradisavljevic18@gmail.com";

export default function DataDeletion() {
  return (
    <LegalPage title="Brisanje podataka" updated="11. septembar 2026.">
      <p>
        Ovo uputstvo objašnjava kako da uklonite podatke koje EcommNode čuva o vama, uključujući
        podatke povezane preko vašeg Facebook/Meta naloga.
      </p>

      <h2>1. Uklanjanje jedne integracije (npr. Meta Ads)</h2>
      <p>
        Prijavite se na <strong>ecommnode.com</strong>, otvorite{" "}
        <strong>Podešavanja → Integracije</strong>, pronađite integraciju (npr. Meta Ads,
        Messenger, Google Analytics...) i izaberite <strong>„Ukloni integraciju“</strong>.
        Sačuvani pristupni token se odmah trajno briše sa servera — EcommNode od tog trenutka
        nema nikakav pristup toj platformi.
      </p>

      <h2>2. Brisanje celog naloga i svih podataka</h2>
      <p>
        Pošaljite zahtev sa e-mail adrese registrovane na nalogu na{" "}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Zahtev%20za%20brisanje%20naloga`}>
          {CONTACT_EMAIL}
        </a>{" "}
        sa naslovom „Zahtev za brisanje naloga“. U roku od 30 dana brišemo:
      </p>
      <ul>
        <li>vaš profil i nalog (ime, e-mail, lozinka),</li>
        <li>sve sačuvane pristupne tokene za povezane integracije,</li>
        <li>keširane poslovne podatke (porudžbine, analitiku, poruke) vezane za vaš nalog.</li>
      </ul>

      <h2>3. Ako ste EcommNode-u dali pristup preko Facebook prijave</h2>
      <p>
        Odjavu možete uraditi i direktno kroz Facebook: Meta nalog → Podešavanja i privatnost →
        Podešavanja → Aplikacije i veb-sajtovi → pronađite <strong>EcommNode</strong> i
        izaberite <strong>Ukloni</strong>. Ovo prekida pristup sa Facebook strane; za brisanje
        podataka koje je EcommNode već sačuvao, pratite korake 1 ili 2 iznad.
      </p>

      <h2>Kontakt</h2>
      <p>
        Pitanja u vezi sa brisanjem podataka: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
