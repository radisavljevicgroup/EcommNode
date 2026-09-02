// Metrike su grupisane u 4 kvadranta. Svaki kvadrant ima jednu glavnu
// metriku (prikazana istaknuto) i, po potrebi, pod-metrike (a, b, c...).
export const KPI_QUADRANTS = [
  {
    key: "volume",
    title: "Prodajni obim",
    metrics: [
      {
        key: "orderCount",
        label: "Broj porudžbina",
        definition: "Ukupan broj realizovanih porudžbina u periodu.",
        format: "integer",
      },
      {
        key: "cr",
        label: "CR",
        definition:
          "Conversion Rate — procenat GA4 poseta koje su rezultovale porudžbinom (Broj porudžbina / GA4 sesije). Računa se samo za prodavnice koje imaju povezan Google Analytics 4.",
        format: "percent",
      },
    ],
  },
  {
    key: "basket",
    title: "Vrednost korpe i transakcija",
    metrics: [
      {
        key: "aov",
        label: "AOV",
        definition:
          "Average Order Value — prosečna vrednost korpe (Ukupan prihod / Ukupan broj porudžbina).",
        format: "currency",
      },
      {
        key: "upt",
        label: "UPT",
        definition:
          "Units Per Transaction — prosečan broj artikala po porudžbini (Ukupan broj prodatih artikala / Ukupan broj porudžbina).",
        format: "decimal",
      },
    ],
  },
  {
    key: "logistics",
    title: "Logistika i operacije",
    metrics: [
      {
        key: "shippingPercent",
        label: "Procenat dostave",
        definition: "Udio troškova dostave u ukupnom prihodu.",
        format: "percent",
      },
      {
        key: "ofct",
        label: "OFCT",
        definition:
          "Order Fulfillment Cycle Time — prosečno vreme od kreiranja porudžbine do slanja na dostavu.",
        format: "days",
      },
      {
        key: "returnRate",
        label: "RR",
        definition:
          "Return Rate — stopa otkazanih ili vraćenih porudžbina (Vraćene/Otkazane / Ukupne porudžbine).",
        format: "percent",
      },
    ],
  },
  {
    key: "customers",
    title: "Vrednost i ponašanje kupaca",
    wide: true,
    metrics: [
      {
        key: "ltv",
        label: "LTV",
        definition:
          "Customer Lifetime Value — ukupna istorijska potrošnja po jedinstvenom kupcu (kupac je identifikovan preko broja telefona).",
        format: "currency",
      },
      {
        key: "rpr",
        label: "RPR",
        definition:
          "Repeat Purchase Rate — procenat kupaca sa više od 1 porudžbine (Povratni kupci / Ukupni jedinstveni kupci).",
        format: "percent",
      },
      {
        key: "tbo",
        label: "TBO",
        definition:
          "Time Between Orders — prosečno vreme (u danima) između uzastopnih kupovina istog kupca.",
        format: "days",
      },
      {
        key: "clv",
        label: "CLV",
        definition:
          "Predikcija životne vrednosti — procenjena ukupna vrednost koju će prosečan kupac doneti tokom celog svog životnog veka. Heuristička procena (AOV × učestalost kupovine × procenjeni životni vek), ne pravi prediktivni model.",
        format: "currency",
      },
      {
        key: "cac",
        label: "CAC",
        definition:
          "Customer Acquisition Cost — prosečna cena akvizicije novog kupca (Potrošnja na Meta oglase / Broj novih kupaca u periodu — kupac čija je prva ikad porudžbina u ovom periodu). Računa se samo za prodavnice koje imaju povezan Meta Ads.",
        format: "currency",
      },
    ],
  },
];

// Flat list, still used where a plain lookup by key is handy.
export const KPI_DEFINITIONS = KPI_QUADRANTS.flatMap((q) => q.metrics);
