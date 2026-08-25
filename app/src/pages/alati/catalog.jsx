import { ClockIcon, ReceiptIcon } from "../../icons";

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
];
