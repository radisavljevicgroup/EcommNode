import { ClockIcon, ReceiptIcon, PersonalizeIcon } from "../../icons";

// Add new tools here — each entry gets a card in "Sve alatke" and, once
// enabled, a row in "Moje alatke".
export const TOOLS = [
  {
    key: "stale",
    name: "Praćenje zastarelih porudžbina",
    icon: ClockIcon,
    shortDesc: "Upozorava kad se probije zakonski rok isporuke od 30 dana.",
    desc: (
      <>
        Zakon nalaže isporuku robe u roku od 30 dana od trenutka kreiranja porudžbine —
        probijanje tog roka nosi pravni rizik. Alatka prati porudžbine u statusu{" "}
        <strong>„Na čekanju"</strong> i <strong>„U obradi"</strong> i javlja upozorenje na
        stranici Porudžbine čim neka od njih predugo čeka, sa opcijom da se odmah filtriraju i
        vide.
      </>
    ),
  },
  {
    key: "unfiscalized",
    name: "Praćenje nefiskalizovanih računa",
    icon: ReceiptIcon,
    shortDesc: "Upozorava na završene porudžbine bez izdatog fiskalnog računa.",
    desc: (
      <>
        Za svaku realizovanu prodaju zakon zahteva izdavanje fiskalnog računa — propust
        povlači novčanu kaznu. Alatka prati porudžbine u statusu <strong>„Gotovo"</strong>{" "}
        kojima račun još nije fiskalizovan i javlja upozorenje na stranici Porudžbine, sa
        opcijom da se odmah filtriraju i vide.
      </>
    ),
  },
  {
    key: "personalization",
    name: "Personalizacija porudžbina",
    icon: PersonalizeIcon,
    shortDesc: "Kupac prilaže fajlove za personalizaciju uz izabrane proizvode.",
    desc: (
      <>
        Za proizvode koje označiš kao personalizabilne, na stranici Porudžbine se pored
        ikonice za dostavu pojavljuje dodatna ikonica — klikom se otvara prozor u koji se
        prevlače (ili biraju) fajlovi vezani za personalizaciju te porudžbine (npr. tekst za
        gravuru ili slika za štampu), koji se čuvaju uz konkretnu porudžbinu i proizvod. Koji
        proizvodi aktiviraju alatku bira se ispod, unosom njihovih ID-jeva.
      </>
    ),
  },
];
